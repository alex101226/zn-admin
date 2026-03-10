import mysql from "mysql2/promise";
import config from '../server/config/index.js';

// ===== 数据库配置 =====
const db = await mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
	//	vehicle-web, vehicle-admin
// ======== 想清空的表名集合 ========
const tables = [
  // 'zn_logistics_routes',
  // 'zn_route_stations',
  // 'zn_vehicle_dispatches',
  // 'zn_vehicle_drivers',
  // 'zn_vehicles',
  // 'zn_users',
  // 'zn_user_roles',
  // 'zn_user_permissions'
  'zn_tasks'
]

// ===== 路由：清空表 =====
async function clearTables() {
  try {
    console.log('🔐 关闭外键约束...')
    await db.query('SET FOREIGN_KEY_CHECKS = 0')

    console.log('🧹 开始清空以下表:')
    console.log(tables.join(', '))

    for (const table of tables) {
      try {
        await db.query(`TRUNCATE TABLE \`${table}\``)
        console.log(`✅ ${table} 清空成功`)
      } catch (err) {
        console.error(`❌ ${table} 清空失败: ${err.message}`)
      }
    }

    console.log('🔓 重新开启外键约束...')
    await db.query('SET FOREIGN_KEY_CHECKS = 1')

    console.log('🎉 所有操作完成')
  } catch (err) {
    console.error('❌ 脚本执行失败:', err.message)
  } finally {
    await db.end()
  }
}
clearTables().catch(console.error);
