import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'
import { pumpStreamToFile } from '../utils/pumpStreamToFile.js'
import reply from "../plugins/reply.js";

async function commonRoutes(fastify) {
  //  上传接口
  fastify.post('/upload', async (request, reply) => {
    try {
      const data = await request.file() // 获取单个文件
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      // 按日期创建目录，比如 2025/08/23
      const today = dayjs().format('YYYY/MM/DD')
      const uploadDir = path.join(process.cwd(), 'uploads', today)

      // 确保存储目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      // 拆分文件名和后缀
      const ext = path.extname(data.filename) // .jpeg
      const name = path.basename(data.filename, ext) // video9

      // 保留原文件名
      const timestamp = Date.now()
      const newFilename = `${name}-${timestamp}${ext}`
      const filepath = path.join(uploadDir, newFilename)

      // 将文件写入磁盘
      await pumpStreamToFile(data.file, filepath)

      return reply.send({
        message: '上传成功',
        data: {
          url: `/uploads/${today}/${newFilename}`, // 可作为访问路径
        },
      })

    } catch(err) {
      fastify.log.error('上传报错================》〉》', err);
      // reply.status(500).send({ error: '服务器错误' });
      throw err;
    }
  })

  //  查找所有的司机数据
  fastify.get('/getDriver', async (request, reply) => {
    const [rows] = await fastify.db.execute('SELECT * FROM zn_drivers');
    reply.send({
      data: {
        data: rows
      }
    });
  })

  //  查询所有的地址
  fastify.get('/getLocations', async (request, reply) => {
    const [rows] = await fastify.db.execute('SELECT * FROM zn_locations')
    const [[{ total }]] = await fastify.db.execute('SELECT COUNT(*) AS total FROM zn_locations')

    return reply.send({
      data: {
        data: rows,
        total: total
      }
    })
  })

  //统计
  fastify.get('/systemCount', async (request, reply) => {
	//	司机的统计
	const  [[{ driveCount }]] = await fastify.db.execute('SELECT COUNT(*) AS driveCount FROM zn_drivers')
	//	电子围栏的统计
	const  [[{ fencesCount }]] = await fastify.db.execute('SELECT COUNT(*) AS fencesCount FROM zn_electronic_fences')
	//	路线的统计
	const  [[{ routesCount }]] = await fastify.db.execute('SELECT COUNT(*) AS routesCount FROM zn_logistics_routes')
		console.log('路线的统计', routesCount)
	//	调度任务的统计
	const  [[{ dispatchesCount }]] = await fastify.db.execute('SELECT COUNT(*) AS dispatchesCount FROM zn_vehicle_dispatches')

	//	车辆
	const [[{ vehicleCount }]] = await fastify.db.execute(`
      SELECT COUNT(*) AS vehicleCount
      FROM zn_vehicles
    `);

	const [[{ vehicleStatusCount }]] = await fastify.db.query(`
      SELECT COUNT(*) AS vehicleStatusCount
      FROM zn_vehicles
      WHERE status IN ('1', '4')
    `);

	return reply.send({
	  data: {
		driveCount,
		fencesCount,
		routesCount,
		dispatchesCount,
		vehicleCount,
		vehicleStatusCount
	  }
	})
  })

  //	统计2
  fastify.get('/deviceCount', async (request, reply) => {
	try {
	  // 1. 车辆统计
	  const [vehicleRows] = await fastify.db.execute(`
      SELECT 
        SUM(CASE WHEN status IN ('1', '3') THEN 1 ELSE 0 END) AS normalCount,
        COUNT(*) AS totalCount
      FROM zn_vehicles
    `);

	  // 4. 路线统计
	  const [routeRows] = await fastify.db.execute(`
      SELECT
        SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END) AS normalCount,
        COUNT(*) AS totalCount
      FROM zn_logistics_routes
    `);

	  const responseData = {
		vehicles: [
		  { label: '正常', value: vehicleRows[0].normalCount },
		  { label: '故障', value: vehicleRows[0].totalCount - vehicleRows[0].normalCount },
		],
		routes: [
		  { label: '正常', value: routeRows[0].normalCount },
		  { label: '禁用', value: routeRows[0].totalCount - routeRows[0].normalCount },
		],
	  };

	  return reply.send({
		code: 0,
		message: 'success',
		data: responseData,
	  });
	} catch (err) {
	  fastify.log.error(err);
	  return reply.status(500).send({ code: -1, message: 'Server error' });
	}
  })

	//	统计3
  fastify.get('/vehicleTaskCount', async (request, reply) => {
	try {
	  // 1. 总运输时间（小时）
	  const [timeRows] = await fastify.db.execute(`
          SELECT
              ROUND(
                      SUM(
                              IFNULL(TIMESTAMPDIFF(SECOND, start_time, end_time), 0)
                      ) / 3600, 2
              ) AS totalHours
          FROM zn_vehicle_dispatches
          WHERE start_time IS NOT NULL AND end_time IS NOT NULL
	  `);

	  // 2. 总里程数
	  const [distanceRows] = await fastify.db.execute(`
      SELECT 
        SUM(r.distance_km) AS totalDistanceKm
      FROM zn_vehicle_dispatches d
      JOIN zn_logistics_routes r ON d.route_id = r.id
      WHERE d.transport_status = '4'
    `);

	  // 3. 已完成任务数
	  const [completedTaskRows] = await fastify.db.execute(`
      SELECT COUNT(*) AS completedTaskCount 
      FROM zn_vehicle_dispatches 
      WHERE transport_status = '4'
    `);

	  // 4. 总任务数
	  const [totalTaskRows] = await fastify.db.execute(`
      SELECT COUNT(*) AS totalTaskCount 
      FROM zn_vehicle_dispatches
    `);

	  return reply.send({
		code: 0,
		message: 'success',
		data: {
		  totalHours: timeRows[0].totalHours || 0,
		  totalDistanceKm: distanceRows[0].totalDistanceKm || 0,
		  completedTaskCount: completedTaskRows[0].completedTaskCount,
		  totalTaskCount: totalTaskRows[0].totalTaskCount,
		},
	  });
	} catch (err) {
	  fastify.log.error(err);
	  return reply.status(500).send({ code: -1, message: 'Server error' });
	}
  })
}
export default commonRoutes;