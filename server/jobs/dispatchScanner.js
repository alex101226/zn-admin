import cron from 'node-cron';
// import {getRealRunningTime} from "../utils/date.js";


/**
 * 车辆调度任务的定时器
 * @param {object} fastify - Fastify 实例 (包含 db 插件)
 * (* * * * * → 每分钟执行一次)
 * (*\/5 * * * * → 每 5 分钟执行一次)
 * (0 * * * * → 每小时的第 0 分钟执行一次（整点跑）)
 * (0 9 * * * → 每天早上 9 点执行)
 * (0 0 * * 0 → 每周日 0 点执行)
 * (0 *\/12 * * *, 12小时执行一次)
 */
export function dispatchScanner(fastify)  {
  cron.schedule('* * * * *', async () => {
    fastify.log.info('[车辆调度任务] 开始扫描运行中任务...');
    try {
      // 查出调度表中正在执行的调度任务
      const [runningDispatches] = await fastify.db.execute(
          `SELECT
                id,
                expected_end_time,
                vehicle_id,
                (NOW() >= expected_end_time) AS shouldEnd
            FROM zn_vehicle_dispatches WHERE dispatch_status = 1`
      )
      if (runningDispatches.length === 0) return;
      const now = new Date();

      for (const dispatch of runningDispatches) {
        // console.log('查看dispatch', dispatch)
        // 如果达到预计结束时间
        if (dispatch.shouldEnd) {
          await fastify.db.execute(
              `UPDATE zn_vehicle_dispatches
             SET dispatch_status = '3',
                 transport_status = '4',
                 end_time = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
              [dispatch.id]
          );

          //  修改车辆状态等
          await fastify.db.execute(
              `UPDATE zn_vehicles
               SET status = '4',
                   assigned_route_id = NULL,
                   updated_at = NOW()
               WHERE id = ?`,
              [dispatch.vehicle_id]
          );

          fastify.log.info(`[车辆调度] 任务 ${dispatch.id} 已完成，车辆 ${dispatch.vehicle_id} 释放`);
        }
      }
    } catch (err) {
      fastify.log.error(`[vehicle 任务] 出错: ${err.message}`);
    }
  })
}