import { supabase } from '../supabaseClient';

export interface AnalyticsConfigData {
  aircraftConfig: Record<string, { name: string; seats: number }>;
  airlineConfig: Record<string, string>;
  airportConfig: Record<string, string>;
}

const TABLE_NAME = 'analytics_config';

/**
 * Wait for auth to be initialized, then get user
 */
const waitForAuthReady = async (): Promise<any | null> => {
  console.log('[Config] ⏳ Waiting for auth to initialize...');
  
  return new Promise((resolve) => {
    let resolved = false;
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Config] 📢 Auth event:', event, '| Has user:', !!session?.user);
      
      // When auth is ready, we get INITIAL_SESSION or SIGNED_IN event
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (!resolved) {
          resolved = true;
          if (session?.user) {
            console.log('[Config] ✅ Auth ready, user found:', session.user.id);
            subscription?.unsubscribe();
            resolve(session.user);
          } else {
            console.log('[Config] ℹ️ Auth ready, but no user (not logged in)');
            // Continue waiting for SIGNED_IN
          }
        }
      }
    });
    
    // Additional fallback: try getUser/getSession after a delay
    setTimeout(async () => {
      if (!resolved) {
        // Try to get user from local storage
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !resolved) {
          resolved = true;
          console.log('[Config] ✅ Got user from localStorage:', user.id);
          subscription?.unsubscribe();
          resolve(user);
        }
      }
    }, 1000);
    
    // Timeout after 8 seconds
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('[Config] ⏱️ Auth wait timeout after 8s');
        subscription?.unsubscribe();
        resolve(null);
      }
    }, 8000);
  });
};

/**
 * Get current authenticated user - improved version
 */
const getCurrentUser = async (): Promise<any | null> => {
  try {
    // First, wait for auth to be ready
    const authReadyUser = await waitForAuthReady();
    if (authReadyUser) {
      console.log('[Config] ✅ User from auth ready:', authReadyUser.id);
      return authReadyUser;
    }

    // Fallback: try refresh session
    console.log('[Config] 🔄 Trying refreshSession...');
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    
    if (refreshed?.user) {
      console.log('[Config] ✅ Got user from refresh:', refreshed.user.id);
      return refreshed.user;
    }

    // Last attempt: direct getUser
    console.log('[Config] 🔍 Trying getUser...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      console.log('[Config] ✅ Got user from getUser:', user.id);
      return user;
    }

    console.warn('[Config] ⚠️ No user found');
    console.log('[Config] 💡 Possible reasons: 1) User not logged in 2) Session expired 3) Network issue');
    return null;
  } catch (error) {
    console.error('[Config] ❌ Exception:', error);
    return null;
  }
};

/**
 * Load config from Supabase
 */
export const loadConfigFromSupabase = async (): Promise<AnalyticsConfigData | null> => {
  try {
    // Get current user using reliable method
    const user = await getCurrentUser();
    
    if (!user) {
      console.log('[Config] No authenticated user');
      return null;
    }

    console.log('[Config] Loading for user:', user.id);

    // Fetch config from Supabase
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('aircraftConfig, airlineConfig, airportConfig')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is normal for new users
        console.log('[Config] No config found for user, will use defaults');
        return null;
      }
      console.error('[Config] Error loading config:', error);
      return null;
    }

    if (!data) {
      console.log('[Config] Empty result from database');
      return null;
    }

    console.log('[Config] ✅ Successfully loaded from Supabase');
    return {
      aircraftConfig: data.aircraftConfig || {},
      airlineConfig: data.airlineConfig || {},
      airportConfig: data.airportConfig || {},
    };
  } catch (error) {
    console.error('[Config] Failed to load config from Supabase:', error);
    return null;
  }
};

/**
 * Save config to Supabase with retry logic
 */
export const saveConfigToSupabase = async (config: AnalyticsConfigData): Promise<boolean> => {
  try {
    console.log('[Config] 🔄 Starting save process...');
    
    // Get current user using reliable method
    const user = await getCurrentUser();
    
    if (!user) {
      console.warn('[Config] ❌ No authenticated user found');
      return false;
    }

    console.log('[Config] ✅ Got user:', user.id);

    // Check if config exists
    console.log('[Config] Checking if config exists...');
    const { data: existingData, error: selectError } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('user_id', user.id)
      .single();

    console.log('[Config] Select result:', { hasData: !!existingData, error: selectError?.message });

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('[Config] ❌ Error checking existing config:', selectError);
      return false;
    }

    if (existingData) {
      // Update existing config
      console.log('[Config] 🔄 Updating existing config...');
      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({
          aircraftConfig: config.aircraftConfig,
          airlineConfig: config.airlineConfig,
          airportConfig: config.airportConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[Config] ❌ Error updating config:', updateError);
        return false;
      }
      console.log('[Config] ✅ Config updated in Supabase');
    } else {
      // Insert new config
      console.log('[Config] ➕ Inserting new config...');
      console.log('[Config] Attempting insert with data:', {
        user_id: user.id,
        aircraftKeys: Object.keys(config.aircraftConfig).length,
        airlineKeys: Object.keys(config.airlineConfig).length,
        airportKeys: Object.keys(config.airportConfig).length,
      });

      const { data: insertResult, error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert({
          user_id: user.id,
          aircraftConfig: config.aircraftConfig,
          airlineConfig: config.airlineConfig,
          airportConfig: config.airportConfig,
        })
        .select();

      if (insertError) {
        console.error('[Config] ❌ Error inserting config:');
        console.error('[Config] Code:', insertError.code);
        console.error('[Config] Message:', insertError.message);
        console.error('[Config] Details:', insertError);
        return false;
      }
      console.log('[Config] ✅ Config inserted into Supabase', insertResult);
    }

    return true;
  } catch (error) {
    console.error('[Config] ❌ Exception:', error);
    return false;
  }
};

/**
 * Delete config from Supabase
 */
export const deleteConfigFromSupabase = async (): Promise<boolean> => {
  try {
    // Get current user using reliable method
    const user = await getCurrentUser();
    
    if (!user) {
      console.warn('[Config] No authenticated user');
      return false;
    }

    console.log('[Config] Deleting config for user:', user.id);

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('[Config] Error deleting config:', error);
      return false;
    }

    console.log('[Config] ✅ Config deleted from Supabase');
    return true;
  } catch (error) {
    console.error('[Config] Failed to delete config from Supabase:', error);
    return false;
  }
};
