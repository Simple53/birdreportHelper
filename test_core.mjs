import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');

const core = require(path.join(ROOT, 'birdreport-exporter.user.js'));

// Verify zero emoji characters remain in src/core.js
const coreSrc = fs.readFileSync(path.join(ROOT, 'src', 'core.js'), 'utf-8');
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
assert.equal(emojiRe.test(coreSrc), false, 'Found emoji in src/core.js');

const z4TaxonList = [
  {
    id: 1412,
    name: '树麻雀',
    latinname: 'Passer montanus',
    englishname: 'Eurasian Tree Sparrow',
    taxonordername: '雀形目',
    taxonfamilyname: '雀科',
    china_level: '',
    iucn: 'LC',
  },
  {
    id: 62,
    name: '绿头鸭',
    latinname: 'Anas platyrhynchos',
    englishname: 'Mallard',
    taxonordername: '雁形目',
    taxonfamilyname: '鸭科',
    china_level: '',
    iucn: 'LC',
  },
  {
    id: 310,
    name: '白鹭',
    latinname: 'Egretta garzetta',
    englishname: 'Little Egret',
    taxonordername: '鹈形目',
    taxonfamilyname: '鹭科',
    china_level: '',
    iucn: 'LC',
  },
];

const groupBirds = [
  {
    taxon_id: 1412,
    taxon_name: '树麻雀',
    latinname: 'Passer montanus',
    englishname: 'Eurasian Tree Sparrow',
    taxonordername: '雀形目',
    taxonfamilyname: '雀科',
    record_num: 2,
    earlist_time: '2024-03-01 08:30:00',
  },
  {
    taxon_id: 62,
    taxon_name: '绿头鸭',
    latinname: 'Anas platyrhynchos',
    englishname: 'Mallard',
    taxonordername: '雁形目',
    taxonfamilyname: '鸭科',
    record_num: 1,
    earlist_time: '2024-03-01 08:30:00',
  },
  {
    taxon_id: 310,
    taxon_name: '白鹭',
    latinname: 'Egretta garzetta',
    englishname: 'Little Egret',
    taxonordername: '鹈形目',
    taxonfamilyname: '鹭科',
    record_num: 2,
    earlist_time: '2024-03-01 08:30:00',
  },
];

const timelineData = [
  { start_time: '2024-03-01 08:30:00', taxon_names: '白鹭[Egretta garzetta],树麻雀[Passer montanus],绿头鸭[Anas platyrhynchos]' },
];

// Regression test for exact real-world birdreport.cn schema:
// Multiple sightings in the SAME report share the EXACT SAME `id` (= activity_id)!
const allRecords = [
  // Report #1 (id = 90001): 3 species in one trip
  {
    id: 90001,
    serial_id: 'BR20240301001',
    taxon_id: 1412,
    taxon_name: '树麻雀',
    latinname: 'Passer montanus',
    province_name: '北京市',
    city_name: '北京市',
    district_name: '朝阳区',
    point_name: '奥林匹克森林公园',
    start_time: '2024-03-01 08:30:00',
    end_time: '2024-03-01 10:30:00',
    taxon_count: 15,
    data_type: 1,
    outside_type: 0,
    ctime: '2024-03-01 12:00:00',
  },
  {
    id: 90001,
    serial_id: 'BR20240301001',
    taxon_id: 62,
    taxon_name: '绿头鸭',
    latinname: 'Anas platyrhynchos',
    province_name: '北京市',
    city_name: '北京市',
    district_name: '朝阳区',
    point_name: '奥林匹克森林公园',
    start_time: '2024-03-01 08:30:00',
    end_time: '2024-03-01 10:30:00',
    taxon_count: 6,
    data_type: 1,
    outside_type: 0,
    ctime: '2024-03-01 12:00:00',
  },
  {
    id: 90001,
    serial_id: 'BR20240301001',
    taxon_id: 310,
    taxon_name: '白鹭',
    latinname: 'Egretta garzetta',
    province_name: '北京市',
    city_name: '北京市',
    district_name: '朝阳区',
    point_name: '奥林匹克森林公园',
    start_time: '2024-03-01 08:30:00',
    end_time: '2024-03-01 10:30:00',
    taxon_count: 3,
    data_type: 1,
    outside_type: 0,
    ctime: '2024-03-01 12:00:00',
  },
  // Report #2 (id = 90002): later sighting of 白鹭 and 树麻雀 on 2026-11-15
  {
    id: 90002,
    serial_id: 'BR20261115002',
    taxon_id: 310,
    taxon_name: '白鹭',
    latinname: 'Egretta garzetta',
    province_name: '江苏省',
    city_name: '南京市',
    district_name: '玄武区',
    point_name: '玄武湖公园',
    start_time: '2026-11-15 09:00:00',
    end_time: '2026-11-15 11:00:00',
    taxon_count: 4,
    data_type: 1,
    outside_type: 0,
    ctime: '2026-11-15 12:00:00',
  },
  {
    id: 90002,
    serial_id: 'BR20261115002',
    taxon_id: 1412,
    taxon_name: '树麻雀',
    latinname: 'Passer montanus',
    province_name: '江苏省',
    city_name: '南京市',
    district_name: '玄武区',
    point_name: '玄武湖公园',
    start_time: '2026-11-15 09:00:00',
    end_time: '2026-11-15 11:00:00',
    taxon_count: 10,
    data_type: 1,
    outside_type: 0,
    ctime: '2026-11-15 12:00:00',
  },
];

const ds = core.buildExportDataset({
  account: 'test_birder',
  z4TaxonList,
  groupBirds,
  timelineData,
  allRecords,
  sortOrder: 'asc',
  includeOutside: false,
});

// Must preserve ALL 5 raw sighting rows (NOT collapsed to 2 by shared activity `id`!)
assert.equal(ds.records.length, 5);
assert.equal(ds.reports.length, 2);
assert.equal(ds.speciesTimeline.length, 3);
assert.equal(ds.summary.totalReports, 2);
assert.equal(ds.summary.totalRecords, 5);

// 白鹭 MUST resolve its earliest sighting to 2024-03-01 奥林匹克森林公园 (NOT 2026-11-15!)
const egret = ds.speciesTimeline.find((x) => x.taxonName === '白鹭');
assert.equal(egret.firstDate, '2024-03-01');
assert.equal(egret.firstPointName, '奥林匹克森林公园');
assert.equal(egret.genusZh, '白鹭属');
assert.equal(egret.genusLatin, 'Egretta');
assert.equal(egret.allLocationsCount, 2);

// Verify report summary sheet
assert.equal(ds.reports[0].serialId, 'BR20240301001');
assert.equal(ds.reports[0].speciesCount, 3);
assert.equal(ds.reports[0].newSpeciesCount, 3);
assert.equal(ds.reports[0].rowCount, 3);
assert.equal(ds.reports[1].serialId, 'BR20261115002');
assert.equal(ds.reports[1].speciesCount, 2);
assert.equal(ds.reports[1].newSpeciesCount, 0);

// Generate 4-sheet XLSX for openpyxl verification
const xlsxBytes = core.buildXlsxBytes(ds);
const tmpXlsx = path.join(ROOT, '_test_verify.xlsx');
fs.writeFileSync(tmpXlsx, xlsxBytes);
console.log('All Node regression tests PASSED! Temp XLSX:', xlsxBytes.length, 'bytes');
