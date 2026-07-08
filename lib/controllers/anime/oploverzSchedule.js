/**
 * @title Oploverz Schedule
 * @summary Jadwal Rilis Anime.
 * @description Mengambil jadwal rilis anime mingguan dari Oploverz.
 * @method GET
 * @path /api/anime/oploverz/schedule
 * @response json
 * @example
 * async function getSchedule() {
 *   const res = await fetch('/api/anime/oploverz/schedule');
 *   const data = await res.json();
 *   console.log(data);
 * }
 */
const { getDomain, getSchedule } = require('../../oploverz');

const oploverzScheduleController = async (req) => {
    const domain = await getDomain();
    const result = await getSchedule(domain);
    return result;
};

module.exports = oploverzScheduleController;