/**
 * Migration script: Di chuyển config từ localStorage sang Supabase
 * Chạy trong console trình duyệt hoặc tạo một page tạm để chạy
 */

async function migrateConfigToSupabase() {
  // Lấy dữ liệu từ localStorage
  const aircraftConfig = localStorage.getItem('analytics_aircraftConfig');
  const airlineConfig = localStorage.getItem('analytics_airlineConfig');
  const airportConfig = localStorage.getItem('analytics_airportConfig');

  console.log('📦 Dữ liệu cũ từ localStorage:');
  console.log('Aircraft:', aircraftConfig);
  console.log('Airline:', airlineConfig);
  console.log('Airport:', airportConfig);

  // Nếu không có dữ liệu cũ, thôi
  if (!aircraftConfig && !airlineConfig && !airportConfig) {
    console.warn('⚠️ Không tìm thấy dữ liệu cũ trong localStorage');
    return;
  }

  // Chuyển sang object
  const config = {
    aircraftConfig: aircraftConfig ? JSON.parse(aircraftConfig) : {},
    airlineConfig: airlineConfig ? JSON.parse(airlineConfig) : {},
    airportConfig: airportConfig ? JSON.parse(airportConfig) : {},
  };

  console.log('✅ Dữ liệu đã parse:', config);

  // Import supabase client
  const { supabase } = await import('../supabaseClient.ts');

  try {
    // Lấy user hiện tại
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Lỗi: Chưa đăng nhập hoặc lỗi auth:', userError);
      return;
    }

    console.log('👤 User ID:', user.id);

    // Kiểm tra xem đã có config chưa
    const { data: existingData, error: selectError } = await supabase
      .from('analytics_config')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;

    if (existingData) {
      // Update nếu đã có
      console.log('🔄 Cập nhật config hiện có...');
      result = await supabase
        .from('analytics_config')
        .update({
          aircraftConfig: config.aircraftConfig,
          airlineConfig: config.airlineConfig,
          airportConfig: config.airportConfig,
        })
        .eq('user_id', user.id);
    } else {
      // Insert nếu chưa có
      console.log('➕ Tạo config mới...');
      result = await supabase.from('analytics_config').insert({
        user_id: user.id,
        aircraftConfig: config.aircraftConfig,
        airlineConfig: config.airlineConfig,
        airportConfig: config.airportConfig,
      });
    }

    if (result.error) {
      console.error('❌ Lỗi khi lưu config:', result.error);
      return;
    }

    console.log('✅ Đã lưu config lên Supabase thành công!');
    console.log('📊 Dữ liệu:', result.data);

    // Có thể xóa localStorage nếu muốn (optional)
    // localStorage.removeItem('analytics_aircraftConfig');
    // localStorage.removeItem('analytics_airlineConfig');
    // localStorage.removeItem('analytics_airportConfig');
    // console.log('🧹 Đã xóa dữ liệu cũ từ localStorage');
  } catch (error) {
    console.error('❌ Lỗi không mong đợi:', error);
  }
}

// Export để có thể gọi từ component
export { migrateConfigToSupabase };
