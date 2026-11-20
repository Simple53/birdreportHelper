(function (global) {
  'use strict';

  const API_BASE = 'https://api.birdreport.cn/';
  const Z4_TAXON_VERSION = 'Z4-67FA07177A544FBD96006A7CC7489D25';
  const PAGE_SIZE = 200;
  const PAGE_DELAY_MS = 120;
  const MAX_PAGES = 500;
  const AES_KEY_STR = 'C8EB5514AF5ADDB94B2207B08C66601C';
  const AES_IV_STR = '55DD79C6F04E1A67';

  // Build script injects full Zheng-4th-edition dictionary here: { orders, families, genera }
  const TAXONOMY_DICT = /*__TAXONOMY_DICT__*/ { orders: {}, families: {}, genera: {} };

  // =========================================================================
  // 1. Utility & Taxonomy Helpers
  // =========================================================================

  function safeStr(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
  }

  function normalizeTime(t) {
    const s = safeStr(t);
    if (!s) return '';
    return s.replace(/\//g, '-');
  }

  function datePart(t) {
    const s = normalizeTime(t);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  function splitLatinName(latin) {
    const clean = safeStr(latin).replace(/\s+/g, ' ');
    if (!clean) return { genusLatin: '', speciesEpithet: '' };
    const parts = clean.split(' ');
    return {
      genusLatin: parts[0] || '',
      speciesEpithet: parts.slice(1).join(' '),
    };
  }

  function enrichTaxonomy(item, taxonById, taxonByName, groupById, groupByName, dict) {
    const activeDict = dict || TAXONOMY_DICT;
    const tid = safeStr(item.taxon_id || item.id);
    const tname = safeStr(item.taxon_name || item.name);

    const refZ4 = (tid && taxonById.get(tid)) || (tname && taxonByName.get(tname)) || {};
    const refGrp = (tid && groupById.get(tid)) || (tname && groupByName.get(tname)) || {};

    const taxonId = tid || safeStr(refZ4.id || refGrp.taxon_id);
    const taxonName = tname || safeStr(refZ4.name || refGrp.taxon_name);
    const latinName = safeStr(item.latinname || refGrp.latinname || refZ4.latinname);
    const englishName = safeStr(item.englishname || refGrp.englishname || refZ4.englishname);
    const orderZh = safeStr(item.taxonordername || refGrp.taxonordername || refZ4.taxonordername);
    const familyZh = safeStr(item.taxonfamilyname || refGrp.taxonfamilyname || refZ4.taxonfamilyname);
    const chinaLevel = safeStr(item.china_level || refGrp.china_level || refZ4.china_level);
    const iucn = safeStr(item.iucn || refGrp.iucn || refZ4.iucn);
    const cites = safeStr(item.cites || refGrp.cites || refZ4.cites);

    const { genusLatin, speciesEpithet } = splitLatinName(latinName);
    const orderLatin = (activeDict.orders && activeDict.orders[orderZh]) || '';
    const familyLatin = (activeDict.families && activeDict.families[familyZh]) || '';
    const genusZh = (activeDict.genera && activeDict.genera[genusLatin]) || '';

    return {
      taxonId,
      taxonName,
      latinName,
      englishName,
      orderZh,
      orderLatin,
      familyZh,
      familyLatin,
      genusZh,
      genusLatin,
      speciesEpithet,
      chinaLevel,
      iucn,
      cites,
    };
  }

  function formatLocation(rec) {
    const prov = safeStr(rec.province_name);
    const city = safeStr(rec.city_name);
    const dist = safeStr(rec.district_name);
    const point = safeStr(rec.point_name);

    const adminParts = [];
    if (prov) adminParts.push(prov);
    if (city && city !== prov) adminParts.push(city);
    if (dist && dist !== city) adminParts.push(dist);

    const adminStr = adminParts.join(' ');
    let fullLocation = adminStr;
    if (point) {
      fullLocation = adminStr
        ? (point.startsWith(adminParts[0]) ? point : `${adminStr} - ${point}`)
        : point;
    }

    return {
      province: prov,
      city,
      district: dist,
      pointName: point || adminParts.join(''),
      fullLocation: fullLocation || '-',
    };
  }

  function formatRecordType(rec) {
    if (Number(rec.data_type) === 1) return '定点记';
    if (rec.media_type === 'IMAGE') return '图片记';
    if (rec.media_type === 'VOICE') return '声音记';
    return '随手记';
  }

  function formatOutsideStatus(rec) {
    if (Number(rec.outside_type) !== 1) return '正常';
    if (Number(rec.checker) === 1) return '分布外(已复核通过)';
    if (Number(rec.escaped) === 1) return '逸出/笼养逃逸';
    return '分布外/待核验';
  }

  function parseTimelineRanks(timelineData) {
    const entries = [];
    const list = Array.isArray(timelineData) ? timelineData : [];
    for (const dayItem of list) {
      const day = datePart(dayItem.start_time);
      const rawNames = safeStr(dayItem.taxon_names);
      if (!rawNames) continue;
      const parts = rawNames.split(',');
      for (const p of parts) {
        const name = p.replace(/\[.*$/, '').trim();
        if (name) entries.push({ day, name });
      }
    }
    entries.reverse();
    const rankByName = new Map();
    entries.forEach((e, idx) => {
      if (!rankByName.has(e.name)) {
        rankByName.set(e.name, { rank: idx + 1, day: e.day });
      }
    });
    return rankByName;
  }

  function compareTimeAsc(a, b) {
    const ta = normalizeTime(a);
    const tb = normalizeTime(b);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }

  function recordCompositeKey(r) {
    // Note: in member/system/record/taxon, `r.id` is the report/activity_id (shared across all species in one report),
    // NOT a unique sighting row ID. Never deduplicate by `r.id` alone.
    return [
      safeStr(r.record_id),
      safeStr(r.id),
      safeStr(r.serial_id),
      safeStr(r.taxon_id),
      safeStr(r.taxon_name),
      safeStr(r.start_time),
      safeStr(r.end_time),
      safeStr(r.taxon_count),
      safeStr(r.point_name),
      safeStr(r.ctime),
    ].join('|');
  }

  function dedupeRecords(records) {
    // Only drop exact cross-page duplicates; preserve legitimate repeated rows within the same page.
    const seen = new Set();
    const out = [];
    for (const r of records) {
      const baseKey = recordCompositeKey(r);
      const pageTag = r._pageOccurrence ? `#${r._pageOccurrence}` : '';
      const key = baseKey + pageTag;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }

  // =========================================================================
  // 2. Core Data Merging, Report Aggregation & Timeline Construction
  // =========================================================================

  function buildExportDataset({
    account = '',
    z4TaxonList = [],
    groupBirds = [],
    outsideGroupBirds = [],
    timelineData = [],
    allRecords = [],
    sortOrder = 'asc',
    includeOutside = false,
    taxonomyDict = TAXONOMY_DICT,
  }) {
    const taxonById = new Map();
    const taxonByName = new Map();
    for (const t of z4TaxonList) {
      if (t.id !== undefined && t.id !== null) taxonById.set(String(t.id), t);
      if (t.name) taxonByName.set(String(t.name).trim(), t);
    }

    const combinedGroups = [];
    for (const g of groupBirds) {
      combinedGroups.push({ ...g, _checklistScope: '郑四名录内' });
    }
    if (includeOutside) {
      const existingIds = new Set(groupBirds.map((g) => safeStr(g.taxon_id)));
      for (const g of outsideGroupBirds) {
        if (!existingIds.has(safeStr(g.taxon_id))) {
          combinedGroups.push({ ...g, _checklistScope: '名录外/分布外' });
        }
      }
    }

    const groupById = new Map();
    const groupByName = new Map();
    for (const g of combinedGroups) {
      if (g.taxon_id !== undefined && g.taxon_id !== null) groupById.set(String(g.taxon_id), g);
      if (g.taxon_name) groupByName.set(String(g.taxon_name).trim(), g);
    }

    const timelineRankByName = parseTimelineRanks(timelineData);
    const uniqueRecords = dedupeRecords(allRecords);

    // Filter records if not including outside
    const filteredRecords = includeOutside
      ? uniqueRecords
      : uniqueRecords.filter((r) => Number(r.outside_type) !== 1 || Number(r.checker) === 1);

    // Index ALL filtered records by taxon_id AND taxon_name so no sighting is missed
    const recordsByTaxonId = new Map();
    const recordsByTaxonName = new Map();

    const addToBucket = (map, key, rec) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(rec);
    };

    for (const r of filteredRecords) {
      addToBucket(recordsByTaxonId, safeStr(r.taxon_id), r);
      addToBucket(recordsByTaxonName, safeStr(r.taxon_name), r);
    }

    const sortRecsChrono = (arr) =>
      arr.slice().sort((a, b) => {
        const c1 = compareTimeAsc(a.start_time, b.start_time);
        if (c1 !== 0) return c1;
        const c2 = compareTimeAsc(a.ctime, b.ctime);
        if (c2 !== 0) return c2;
        return safeStr(a.serial_id).localeCompare(safeStr(b.serial_id));
      });

    // Build master species list (prefer combinedGroups; fallback to records if API returned empty)
    const masterSpeciesSource = combinedGroups.length > 0 ? combinedGroups : [];
    const seenSpeciesKeys = new Set();
    const speciesCandidates = [];

    for (const g of masterSpeciesSource) {
      const tid = safeStr(g.taxon_id);
      const tname = safeStr(g.taxon_name);
      const spKey = tid ? `id:${tid}` : `name:${tname}`;
      if (seenSpeciesKeys.has(spKey)) continue;
      seenSpeciesKeys.add(spKey);
      speciesCandidates.push({ group: g, tid, tname });
    }

    if (masterSpeciesSource.length === 0) {
      for (const r of filteredRecords) {
        const tid = safeStr(r.taxon_id);
        const tname = safeStr(r.taxon_name);
        const spKey = tid ? `id:${tid}` : `name:${tname}`;
        if (seenSpeciesKeys.has(spKey)) continue;
        seenSpeciesKeys.add(spKey);
        speciesCandidates.push({
          group: {
            taxon_id: tid,
            taxon_name: tname,
            latinname: r.latinname,
            englishname: r.englishname,
            _checklistScope: Number(r.outside_type) === 1 ? '名录外/分布外' : '郑四名录内',
          },
          tid,
          tname,
        });
      }
    }

    const firstRecordRefs = new Set();

    const timelineItems = speciesCandidates.map(({ group, tid, tname }) => {
      const tax = enrichTaxonomy(group, taxonById, taxonByName, groupById, groupByName, taxonomyDict);

      // Union records matched by taxon_id or taxon_name (covers G3->Z4 ID shifts)
      const matchedSet = new Set();
      for (const k of [tid, tax.taxonId]) {
        if (k && recordsByTaxonId.has(k)) {
          for (const rec of recordsByTaxonId.get(k)) matchedSet.add(rec);
        }
      }
      for (const k of [tname, tax.taxonName]) {
        if (k && recordsByTaxonName.has(k)) {
          for (const rec of recordsByTaxonName.get(k)) matchedSet.add(rec);
        }
      }

      const sortedRecs = sortRecsChrono(Array.from(matchedSet));
      const firstRec = sortedRecs[0] || null;
      if (firstRec) firstRecordRefs.add(firstRec);

      const firstLoc = firstRec
        ? formatLocation(firstRec)
        : { province: '', city: '', district: '', pointName: '', fullLocation: '' };

      const uniqueLocs = [];
      const locSet = new Set();
      let totalIndividualCount = 0;
      for (const rec of sortedRecs) {
        const fl = formatLocation(rec).fullLocation;
        if (fl && fl !== '-' && !locSet.has(fl)) {
          locSet.add(fl);
          uniqueLocs.push(fl);
        }
        const cnt = Number(rec.taxon_count);
        if (!Number.isNaN(cnt) && cnt > 0) totalIndividualCount += cnt;
      }

      const tlInfo = timelineRankByName.get(tax.taxonName) || null;
      const recEarliest = normalizeTime(firstRec && firstRec.start_time);
      const grpEarliest = normalizeTime(group.earlist_time);
      // Prefer the earliest valid timestamp between matched sighting and official group earlist_time
      let firstTime = recEarliest || grpEarliest || (tlInfo && tlInfo.day) || '';
      if (recEarliest && grpEarliest && compareTimeAsc(grpEarliest, recEarliest) < 0) {
        firstTime = grpEarliest;
      }
      const firstDate = datePart(firstTime);

      return {
        _firstTime: firstTime,
        _timelineRank: tlInfo ? tlInfo.rank : Number.MAX_SAFE_INTEGER,
        _taxonIdNum: Number(tax.taxonId) || Number.MAX_SAFE_INTEGER,
        firstSeq: 0,
        firstDate,
        firstTime,
        taxonId: tax.taxonId,
        taxonName: tax.taxonName,
        latinName: tax.latinName,
        englishName: tax.englishName,
        orderZh: tax.orderZh,
        orderLatin: tax.orderLatin,
        familyZh: tax.familyZh,
        familyLatin: tax.familyLatin,
        genusZh: tax.genusZh,
        genusLatin: tax.genusLatin,
        speciesEpithet: tax.speciesEpithet,
        firstProvince: firstLoc.province,
        firstCity: firstLoc.city,
        firstDistrict: firstLoc.district,
        firstPointName: firstLoc.pointName,
        firstFullLocation: firstLoc.fullLocation,
        firstCount: firstRec ? (firstRec.taxon_count ?? '') : '',
        firstSerialId: firstRec ? safeStr(firstRec.serial_id) : '',
        firstRecordType: firstRec ? formatRecordType(firstRec) : '',
        recordNum: Math.max(Number(group.record_num) || 0, sortedRecs.length),
        totalIndividualCount: totalIndividualCount || '',
        allLocationsCount: uniqueLocs.length,
        allLocations: uniqueLocs.join('；'),
        chinaLevel: tax.chinaLevel,
        iucn: tax.iucn,
        cites: tax.cites,
        checklistScope: group._checklistScope || '郑四名录内',
      };
    });

    // Always sort ascending first to assign true chronological 首加序号 (1 = lifetime first species)
    timelineItems.sort((a, b) => {
      const cDay = compareTimeAsc(a.firstDate, b.firstDate);
      if (cDay !== 0) return cDay;
      if (a._timelineRank !== b._timelineRank) return a._timelineRank - b._timelineRank;
      const cTime = compareTimeAsc(a._firstTime, b._firstTime);
      if (cTime !== 0) return cTime;
      return a._taxonIdNum - b._taxonIdNum;
    });

    timelineItems.forEach((item, idx) => {
      item.firstSeq = idx + 1;
    });

    const orderedTimeline = sortOrder === 'desc' ? timelineItems.slice().reverse() : timelineItems;

    // Sheet 2: Full raw observation records (all 600+ rows preserved)
    const sortedAllRecords = filteredRecords.slice().sort((a, b) => {
      const cmp = compareTimeAsc(a.start_time, b.start_time);
      if (cmp !== 0) return sortOrder === 'desc' ? -cmp : cmp;
      return safeStr(a.serial_id).localeCompare(safeStr(b.serial_id));
    });

    const enrichedRecords = sortedAllRecords.map((rec, idx) => {
      const tax = enrichTaxonomy(rec, taxonById, taxonByName, groupById, groupByName, taxonomyDict);
      const loc = formatLocation(rec);
      return {
        seq: idx + 1,
        startTime: normalizeTime(rec.start_time),
        endTime: normalizeTime(rec.end_time),
        obsDate: datePart(rec.start_time),
        isFirstAddition: firstRecordRefs.has(rec) ? '是' : '否',
        taxonId: tax.taxonId,
        taxonName: tax.taxonName,
        latinName: tax.latinName,
        englishName: tax.englishName,
        orderZh: tax.orderZh,
        orderLatin: tax.orderLatin,
        familyZh: tax.familyZh,
        familyLatin: tax.familyLatin,
        genusZh: tax.genusZh,
        genusLatin: tax.genusLatin,
        taxonCount: rec.taxon_count ?? '',
        province: loc.province,
        city: loc.city,
        district: loc.district,
        pointName: loc.pointName,
        fullLocation: loc.fullLocation,
        recordType: formatRecordType(rec),
        serialId: safeStr(rec.serial_id),
        status: formatOutsideStatus(rec),
        chinaLevel: tax.chinaLevel,
        iucn: tax.iucn,
        ctime: normalizeTime(rec.ctime),
      };
    });

    // Sheet 3: Report / Trip summary (grouped by serial_id or activity id)
    const reportMap = new Map();
    for (const rec of sortedAllRecords) {
      const rKey = safeStr(rec.serial_id) || safeStr(rec.id) || `anon:${normalizeTime(rec.start_time)}|${safeStr(rec.point_name)}`;
      if (!reportMap.has(rKey)) {
        const loc = formatLocation(rec);
        reportMap.set(rKey, {
          serialId: safeStr(rec.serial_id) || safeStr(rec.id),
          obsDate: datePart(rec.start_time),
          startTime: normalizeTime(rec.start_time),
          endTime: normalizeTime(rec.end_time),
          province: loc.province,
          city: loc.city,
          district: loc.district,
          pointName: loc.pointName,
          fullLocation: loc.fullLocation,
          recordType: formatRecordType(rec),
          speciesSet: new Set(),
          speciesList: [],
          firstAddedSet: new Set(),
          rowCount: 0,
          totalCount: 0,
        });
      }
      const rep = reportMap.get(rKey);
      rep.rowCount += 1;
      const cnt = Number(rec.taxon_count);
      if (!Number.isNaN(cnt) && cnt > 0) rep.totalCount += cnt;
      const spName = safeStr(rec.taxon_name);
      if (spName && !rep.speciesSet.has(spName)) {
        rep.speciesSet.add(spName);
        rep.speciesList.push(spName);
      }
      if (firstRecordRefs.has(rec) && spName) {
        rep.firstAddedSet.add(spName);
      }
    }

    const reports = Array.from(reportMap.values())
      .sort((a, b) => {
        const cmp = compareTimeAsc(a.startTime, b.startTime);
        return sortOrder === 'desc' ? -cmp : cmp;
      })
      .map((rep, idx) => ({
        seq: idx + 1,
        serialId: rep.serialId,
        obsDate: rep.obsDate,
        startTime: rep.startTime,
        endTime: rep.endTime,
        province: rep.province,
        city: rep.city,
        district: rep.district,
        pointName: rep.pointName,
        fullLocation: rep.fullLocation,
        recordType: rep.recordType,
        speciesCount: rep.speciesSet.size,
        newSpeciesCount: rep.firstAddedSet.size,
        rowCount: rep.rowCount,
        totalCount: rep.totalCount || '',
        speciesNames: rep.speciesList.join('、'),
      }));

    // Sheet 4: Overview statistics
    const orderSet = new Set(timelineItems.map((x) => x.orderZh).filter(Boolean));
    const familySet = new Set(timelineItems.map((x) => x.familyZh).filter(Boolean));
    const genusSet = new Set(timelineItems.map((x) => x.genusLatin).filter(Boolean));

    const yearNewSpecies = new Map();
    const yearRecords = new Map();
    const provNewSpecies = new Map();

    for (const sp of timelineItems) {
      const y = sp.firstDate ? sp.firstDate.slice(0, 4) : '未知年份';
      yearNewSpecies.set(y, (yearNewSpecies.get(y) || 0) + 1);
      const p = sp.firstProvince || '未知省份';
      provNewSpecies.set(p, (provNewSpecies.get(p) || 0) + 1);
    }
    for (const rec of enrichedRecords) {
      const y = rec.obsDate ? rec.obsDate.slice(0, 4) : '未知年份';
      yearRecords.set(y, (yearRecords.get(y) || 0) + 1);
    }

    const yearsSorted = Array.from(new Set([...yearNewSpecies.keys(), ...yearRecords.keys()])).sort();
    const provsSorted = Array.from(provNewSpecies.entries()).sort((a, b) => b[1] - a[1]);

    const summary = {
      account: account || '-',
      exportTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      taxonomyVersion: '《中国鸟类分类与分布名录（第四版）》（郑四版 CH4）',
      totalOrders: orderSet.size,
      totalFamilies: familySet.size,
      totalGenera: genusSet.size,
      totalSpecies: timelineItems.length,
      totalReports: reports.length,
      totalRecords: enrichedRecords.length,
      matchedLocationSpecies: timelineItems.filter((x) => x.firstFullLocation).length,
      years: yearsSorted.map((y) => ({
        year: y,
        newSpecies: yearNewSpecies.get(y) || 0,
        records: yearRecords.get(y) || 0,
      })),
      provinces: provsSorted.map(([prov, cnt]) => ({ province: prov, firstSpeciesCount: cnt })),
    };

    return {
      speciesTimeline: orderedTimeline,
      records: enrichedRecords,
      reports,
      summary,
    };
  }

  // =========================================================================
  // 3. Table Column Definitions
  // =========================================================================

  const SPECIES_COLUMNS = [
    { key: 'firstSeq', header: '首加序号', type: 'number', width: 10 },
    { key: 'firstDate', header: '首次记录日期', width: 14 },
    { key: 'firstTime', header: '首次观测时间', width: 20 },
    { key: 'taxonName', header: '中文名(种)', width: 16 },
    { key: 'latinName', header: '拉丁学名', width: 26, italic: true },
    { key: 'englishName', header: '英文名', width: 26 },
    { key: 'orderZh', header: '目(中文)', width: 12 },
    { key: 'orderLatin', header: '目(拉丁)', width: 18, italic: true },
    { key: 'familyZh', header: '科(中文)', width: 14 },
    { key: 'familyLatin', header: '科(拉丁)', width: 18, italic: true },
    { key: 'genusZh', header: '属(中文)', width: 14 },
    { key: 'genusLatin', header: '属(拉丁)', width: 16, italic: true },
    { key: 'speciesEpithet', header: '种加词', width: 16, italic: true },
    { key: 'firstProvince', header: '首见省', width: 12 },
    { key: 'firstCity', header: '首见市', width: 12 },
    { key: 'firstDistrict', header: '首见区/县', width: 12 },
    { key: 'firstPointName', header: '首见观测点', width: 24 },
    { key: 'firstFullLocation', header: '首见完整地点', width: 32 },
    { key: 'firstCount', header: '首见数量', type: 'number', width: 10 },
    { key: 'firstRecordType', header: '首见记录类型', width: 13 },
    { key: 'firstSerialId', header: '首见报告编号', width: 18 },
    { key: 'recordNum', header: '总记录次数', type: 'number', width: 12 },
    { key: 'totalIndividualCount', header: '累计观测个体数', type: 'number', width: 14 },
    { key: 'allLocationsCount', header: '观测地点数', type: 'number', width: 12 },
    { key: 'allLocations', header: '历史观测地点汇总(去重)', width: 42 },
    { key: 'chinaLevel', header: '国家保护等级', width: 14 },
    { key: 'iucn', header: 'IUCN等级', width: 10 },
    { key: 'taxonId', header: '郑四鸟种编号', width: 13 },
    { key: 'checklistScope', header: '名录归属', width: 13 },
  ];

  const RECORD_COLUMNS = [
    { key: 'seq', header: '序号', type: 'number', width: 8 },
    { key: 'obsDate', header: '观测日期', width: 13 },
    { key: 'startTime', header: '观测开始时间', width: 20 },
    { key: 'endTime', header: '观测结束时间', width: 20 },
    { key: 'isFirstAddition', header: '是否首加', width: 10 },
    { key: 'taxonName', header: '中文名(种)', width: 16 },
    { key: 'latinName', header: '拉丁学名', width: 26, italic: true },
    { key: 'englishName', header: '英文名', width: 26 },
    { key: 'orderZh', header: '目(中文)', width: 12 },
    { key: 'orderLatin', header: '目(拉丁)', width: 18, italic: true },
    { key: 'familyZh', header: '科(中文)', width: 14 },
    { key: 'familyLatin', header: '科(拉丁)', width: 18, italic: true },
    { key: 'genusZh', header: '属(中文)', width: 14 },
    { key: 'genusLatin', header: '属(拉丁)', width: 16, italic: true },
    { key: 'taxonCount', header: '数量', type: 'number', width: 10 },
    { key: 'province', header: '省', width: 12 },
    { key: 'city', header: '市', width: 12 },
    { key: 'district', header: '区/县', width: 12 },
    { key: 'pointName', header: '观测点名称', width: 24 },
    { key: 'fullLocation', header: '完整地点', width: 32 },
    { key: 'recordType', header: '记录类型', width: 11 },
    { key: 'serialId', header: '报告编号', width: 18 },
    { key: 'status', header: '状态', width: 15 },
    { key: 'chinaLevel', header: '国家保护等级', width: 14 },
    { key: 'iucn', header: 'IUCN等级', width: 10 },
    { key: 'taxonId', header: '郑四鸟种编号', width: 13 },
    { key: 'ctime', header: '创建时间', width: 20 },
  ];

  const REPORT_COLUMNS = [
    { key: 'seq', header: '序号', type: 'number', width: 8 },
    { key: 'obsDate', header: '观测日期', width: 13 },
    { key: 'startTime', header: '观测开始时间', width: 20 },
    { key: 'endTime', header: '观测结束时间', width: 20 },
    { key: 'serialId', header: '报告编号', width: 18 },
    { key: 'recordType', header: '记录类型', width: 11 },
    { key: 'province', header: '省', width: 12 },
    { key: 'city', header: '市', width: 12 },
    { key: 'district', header: '区/县', width: 12 },
    { key: 'pointName', header: '观测点名称', width: 24 },
    { key: 'fullLocation', header: '完整地点', width: 32 },
    { key: 'speciesCount', header: '记录鸟种数', type: 'number', width: 12 },
    { key: 'newSpeciesCount', header: '首加新种数', type: 'number', width: 12 },
    { key: 'rowCount', header: '原始记录条数', type: 'number', width: 13 },
    { key: 'totalCount', header: '累计个体数', type: 'number', width: 12 },
    { key: 'speciesNames', header: '观测鸟种列表', width: 52 },
  ];

  // =========================================================================
  // 4. Zero-Dependency Pure-JS XLSX (OOXML + Store ZIP) & CSV Exporters
  // =========================================================================

  function xmlEscape(str) {
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colIndexToLetter(colIdx) {
    let n = colIdx + 1;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function buildWorksheetXml(columns, rows, opts = {}) {
    const colCount = columns.length;
    const rowCount = rows.length + 1;
    const lastCol = colIndexToLetter(Math.max(0, colCount - 1));

    const colsXml = columns
      .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`)
      .join('');

    const parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    parts.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
    parts.push('<sheetViews><sheetView workbookViewId="0"' + (opts.tabSelected ? ' tabSelected="1"' : '') + '>');
    if (opts.freezeHeader !== false) {
      parts.push('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    }
    parts.push('</sheetView></sheetViews>');
    parts.push('<sheetFormatPr defaultRowHeight="20"/>');
    parts.push(`<cols>${colsXml}</cols>`);
    parts.push('<sheetData>');

    let headerCells = '';
    for (let c = 0; c < colCount; c++) {
      const ref = `${colIndexToLetter(c)}1`;
      headerCells += `<c r="${ref}" t="inlineStr" s="1"><is><t>${xmlEscape(columns[c].header)}</t></is></c>`;
    }
    parts.push(`<row r="1" ht="24" customHeight="1">${headerCells}</row>`);

    for (let r = 0; r < rows.length; r++) {
      const rowNum = r + 2;
      const rowObj = rows[r];
      let rowCells = '';
      for (let c = 0; c < colCount; c++) {
        const col = columns[c];
        const rawVal = rowObj[col.key];
        const ref = `${colIndexToLetter(c)}${rowNum}`;
        const styleId = col.italic ? 2 : 0;

        if (rawVal === null || rawVal === undefined || rawVal === '') {
          rowCells += `<c r="${ref}" s="${styleId}"/>`;
        } else if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
          rowCells += `<c r="${ref}" s="${styleId}"><v>${rawVal}</v></c>`;
        } else if (col.type === 'number' && /^-?\d+(\.\d+)?$/.test(String(rawVal).trim())) {
          rowCells += `<c r="${ref}" s="${styleId}"><v>${String(rawVal).trim()}</v></c>`;
        } else {
          rowCells += `<c r="${ref}" t="inlineStr" s="${styleId}"><is><t>${xmlEscape(rawVal)}</t></is></c>`;
        }
      }
      parts.push(`<row r="${rowNum}">${rowCells}</row>`);
    }

    parts.push('</sheetData>');
    if (opts.autoFilter !== false && rowCount >= 1) {
      parts.push(`<autoFilter ref="A1:${lastCol}${rowCount}"/>`);
    }
    parts.push('</worksheet>');
    return parts.join('');
  }

  function buildSummarySheetRows(summary) {
    const rows = [
      { colA: '账号', colB: summary.account, colC: '', colD: '' },
      { colA: '导出时间', colB: summary.exportTime, colC: '', colD: '' },
      { colA: '分类名录标准', colB: summary.taxonomyVersion, colC: '', colD: '' },
      { colA: '总目数', colB: summary.totalOrders, colC: '总科数', colD: summary.totalFamilies },
      { colA: '总属数', colB: summary.totalGenera, colC: '郑四总鸟种数', colD: summary.totalSpecies },
      { colA: '观鸟报告数(行程)', colB: summary.totalReports, colC: '原始记录总条数', colD: summary.totalRecords },
      { colA: '匹配首见地点种数', colB: summary.matchedLocationSpecies, colC: '', colD: '' },
      { colA: '', colB: '', colC: '', colD: '' },
      { colA: '按年份统计', colB: '当年新增首加鸟种数', colC: '当年记录条数', colD: '' },
    ];
    for (const y of summary.years) {
      rows.push({ colA: y.year, colB: y.newSpecies, colC: y.records, colD: '' });
    }
    rows.push({ colA: '', colB: '', colC: '', colD: '' });
    rows.push({ colA: '按首见省份统计', colB: '首加鸟种数', colC: '', colD: '' });
    for (const p of summary.provinces) {
      rows.push({ colA: p.province, colB: p.firstSpeciesCount, colC: '', colD: '' });
    }
    return rows;
  }

  const CRC32_TABLE = (() => {
    const tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      tbl[i] = c >>> 0;
    }
    return tbl;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function createZipUint8Array(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = encoder.encode(f.name);
      const dataBytes = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
      const crc = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0x5421, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x5421, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const totalLen = offset + centralSize + eocd.length;
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const p of localParts) {
      result.set(p, pos);
      pos += p.length;
    }
    for (const p of centralParts) {
      result.set(p, pos);
      pos += p.length;
    }
    result.set(eocd, pos);
    return result;
  }

  function buildXlsxBytes(dataset) {
    const summaryCols = [
      { key: 'colA', header: '指标 / 维度', width: 22 },
      { key: 'colB', header: '数值 / 说明', width: 32 },
      { key: 'colC', header: '辅助指标', width: 24 },
      { key: 'colD', header: '辅助数值', width: 16 },
    ];
    const summaryRows = buildSummarySheetRows(dataset.summary);

    const sheet1Xml = buildWorksheetXml(SPECIES_COLUMNS, dataset.speciesTimeline, { tabSelected: true });
    const sheet2Xml = buildWorksheetXml(RECORD_COLUMNS, dataset.records, { tabSelected: false });
    const sheet3Xml = buildWorksheetXml(REPORT_COLUMNS, dataset.reports, { tabSelected: false });
    const sheet4Xml = buildWorksheetXml(summaryCols, summaryRows, { tabSelected: false, autoFilter: false });

    const contentTypesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>';

    const relsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    const workbookXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' +
      '<sheet name="郑四总鸟种首加时间线" sheetId="1" r:id="rId1"/>' +
      '<sheet name="全部观鸟记录明细" sheetId="2" r:id="rId2"/>' +
      '<sheet name="观鸟报告汇总" sheetId="3" r:id="rId3"/>' +
      '<sheet name="统计概览" sheetId="4" r:id="rId4"/>' +
      '</sheets>' +
      '</workbook>';

    const workbookRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>' +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>' +
      '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    const stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Microsoft YaHei"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font>' +
      '<font><i/><sz val="11"/><name val="Microsoft YaHei"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF1F5E3B"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border>' +
      '<left style="thin"><color rgb="FFE2E4E1"/></left>' +
      '<right style="thin"><color rgb="FFE2E4E1"/></right>' +
      '<top style="thin"><color rgb="FFE2E4E1"/></top>' +
      '<bottom style="thin"><color rgb="FFE2E4E1"/></bottom>' +
      '<diagonal/>' +
      '</border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';

    return createZipUint8Array([
      { name: '[Content_Types].xml', content: contentTypesXml },
      { name: '_rels/.rels', content: relsXml },
      { name: 'xl/workbook.xml', content: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
      { name: 'xl/styles.xml', content: stylesXml },
      { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
      { name: 'xl/worksheets/sheet2.xml', content: sheet2Xml },
      { name: 'xl/worksheets/sheet3.xml', content: sheet3Xml },
      { name: 'xl/worksheets/sheet4.xml', content: sheet4Xml },
    ]);
  }

  function buildCsvString(columns, rows) {
    const escapeCell = (val) => {
      const s = val === null || val === undefined ? '' : String(val);
      if (/[",\r\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [];
    lines.push(columns.map((c) => escapeCell(c.header)).join(','));
    for (const row of rows) {
      lines.push(columns.map((c) => escapeCell(row[c.key])).join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      TAXONOMY_DICT,
      SPECIES_COLUMNS,
      RECORD_COLUMNS,
      REPORT_COLUMNS,
      enrichTaxonomy,
      formatLocation,
      parseTimelineRanks,
      dedupeRecords,
      buildExportDataset,
      buildXlsxBytes,
      buildCsvString,
    };
    return;
  }

  // =========================================================================
  // 5. Browser Network & AES Decryption Layer
  // =========================================================================

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getLoggedInUser() {
    try {
      const raw = localStorage.getItem('$user');
      if (!raw || raw === '{}' || raw === 'null') return null;
      const obj = JSON.parse(raw);
      return obj && obj.token ? obj : null;
    } catch (_) {
      return null;
    }
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensureSiteAesLoaded() {
    if (window.BIRDREPORT_APIJS && typeof window.BIRDREPORT_APIJS.decode === 'function') {
      return true;
    }
    try {
      if (location.hostname.endsWith('birdreport.cn')) {
        if (!window.CryptoJS) {
          await loadScriptOnce('/plugins/crypto-js/crypto-js.min.js');
        }
        await loadScriptOnce('/assets/js/aes.util.js');
        if (window.BIRDREPORT_APIJS && typeof window.BIRDREPORT_APIJS.decode === 'function') {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  async function decryptBirdreportData(cipherOrData) {
    if (Array.isArray(cipherOrData) || (cipherOrData && typeof cipherOrData === 'object')) {
      return cipherOrData;
    }
    if (typeof cipherOrData !== 'string' || !cipherOrData.trim()) {
      return [];
    }

    if (cipherOrData.trim().startsWith('[') || cipherOrData.trim().startsWith('{')) {
      try {
        return JSON.parse(cipherOrData);
      } catch (_) {}
    }

    if (window.BIRDREPORT_APIJS && typeof window.BIRDREPORT_APIJS.decode === 'function') {
      const plain = window.BIRDREPORT_APIJS.decode(cipherOrData);
      return JSON.parse(plain);
    }

    const enc = new TextEncoder();
    const keyBytes = enc.encode(AES_KEY_STR);
    const ivBytes = enc.encode(AES_IV_STR);
    const binStr = atob(cipherOrData);
    const cipherBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) cipherBytes[i] = binStr.charCodeAt(i);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );
    const plainBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: ivBytes },
      cryptoKey,
      cipherBytes
    );
    const plainText = new TextDecoder('utf-8').decode(plainBuf);
    return JSON.parse(plainText);
  }

  async function postApi(path, bodyObj, { token, asJson = false, retries = 3 } = {}) {
    const url = API_BASE + path;
    const headers = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Auth-Token': token,
      'Content-Type': asJson
        ? 'application/json; charset=UTF-8'
        : 'application/x-www-form-urlencoded; charset=UTF-8',
    };

    const body = asJson
      ? JSON.stringify(bodyObj || {})
      : new URLSearchParams(
          Object.entries(bodyObj || {}).map(([k, v]) => [k, v === undefined || v === null ? '' : String(v)])
        ).toString();

    let lastErr = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, { method: 'POST', headers, body });
        if (resp.status === 401) {
          throw new Error('登录凭证已失效（HTTP 401），请重新登录中国观鸟记录中心');
        }
        if (!resp.ok) {
          throw new Error(`接口 ${path} 返回 HTTP ${resp.status}`);
        }
        const json = await resp.json();
        if (json && Number(json.code) === -902) {
          throw new Error('登录已超时，请重新登录后再试');
        }
        return json;
      } catch (err) {
        lastErr = err;
        if (String(err.message).includes('登录')) throw err;
        if (attempt < retries) await sleep(400 * attempt);
      }
    }
    throw lastErr;
  }

  async function fetchAllUserData(options, onProgress) {
    const user = getLoggedInUser();
    if (!user) {
      throw new Error('未检测到登录状态，请先登录中国观鸟记录中心');
    }

    const token = user.token;
    const memberId = user.id;
    const account = user.account || '';
    const startDate = safeStr(options.startDate) || '2000-01-01';
    const endDate = safeStr(options.endDate) || `${new Date().getFullYear()}-12-31`;
    const useCustomDate = Boolean(safeStr(options.startDate) || safeStr(options.endDate));

    onProgress(5, '正在初始化解密组件');
    await ensureSiteAesLoaded();

    onProgress(12, '1/4 获取郑四版分类库');
    let z4TaxonList = [];
    try {
      const z4Res = await postApi(
        'member/system/taxon/version',
        { version: Z4_TAXON_VERSION },
        { token, asJson: false }
      );
      if (z4Res && Array.isArray(z4Res.data)) z4TaxonList = z4Res.data;
    } catch (e) {
      console.warn('[BirdReportExport] 获取郑四分类库失败:', e);
    }

    onProgress(22, '2/4 获取个人郑四总鸟种清单');
    const baseStatParams = {
      version: 'CH4',
      start_min_time: startDate,
      start_max_time: endDate,
      start: startDate,
      end: endDate,
      member_id: memberId,
      outside_type: 0,
    };
    let groupBirds = [];
    const grpRes = await postApi(
      'member/system/user/statistics/record_group_birds',
      baseStatParams,
      { token, asJson: false }
    );
    if (grpRes && Array.isArray(grpRes.data)) groupBirds = grpRes.data;

    let outsideGroupBirds = [];
    if (options.includeOutside) {
      onProgress(28, '2/4 补充拉取名录外鸟种');
      try {
        const outRes = await postApi(
          'member/system/user/statistics/record_group_birds',
          { ...baseStatParams, outside_type: 1 },
          { token, asJson: false }
        );
        if (outRes && Array.isArray(outRes.data)) outsideGroupBirds = outRes.data;
      } catch (e) {
        console.warn('[BirdReportExport] 获取名录外鸟种失败:', e);
      }
    }

    onProgress(34, '3/4 获取官方鸟种首加时间线');
    let timelineData = [];
    try {
      const tlRes = await postApi(
        'member/system/user/statistics/bird_timeline',
        {
          version: 'CH4',
          start_min_time: startDate,
          start_max_time: endDate,
          start: startDate,
          end: endDate,
          member_id: memberId,
        },
        { token, asJson: false }
      );
      if (tlRes && Array.isArray(tlRes.data)) timelineData = tlRes.data;
    } catch (e) {
      console.warn('[BirdReportExport] 获取首加时间线失败:', e);
    }

    onProgress(40, '4/4 正在分页拉取全部原始观鸟记录');
    const allRecords = [];
    let page = 1;
    let totalCount = null;
    let effectiveLimit = PAGE_SIZE;
    let totalPages = 1;
    let fallbackNoVersion = false;

    while (page <= MAX_PAGES) {
      const reqPayload = fallbackNoVersion
        ? {
            start_date: useCustomDate ? startDate : '',
            end_date: useCustomDate ? endDate : '',
            page,
            limit: PAGE_SIZE,
          }
        : {
            version: 'CH4',
            member_id: memberId,
            start_min_time: startDate,
            start_max_time: endDate,
            start_date: startDate,
            end_date: endDate,
            page,
            limit: PAGE_SIZE,
            sortBy: '',
            orderBy: '',
          };

      const recRes = await postApi('member/system/record/taxon', reqPayload, {
        token,
        asJson: true,
      });

      if (page === 1 && (!recRes || !Number(recRes.count)) && !fallbackNoVersion && groupBirds.length > 0) {
        fallbackNoVersion = true;
        continue;
      }

      if (totalCount === null) {
        totalCount = Number(recRes && recRes.count) || 0;
      }

      if (!recRes || !recRes.data || totalCount === 0) break;

      const pageRows = await decryptBirdreportData(recRes.data);
      if (!Array.isArray(pageRows) || pageRows.length === 0) break;

      if (page === 1 && pageRows.length < PAGE_SIZE && totalCount > pageRows.length) {
        effectiveLimit = pageRows.length;
      }
      totalPages = Math.max(1, Math.ceil(totalCount / effectiveLimit));

      // Tag duplicate keys within the same page so legitimate repeated sightings are never dropped
      const inPageCounts = new Map();
      for (const row of pageRows) {
        const k = recordCompositeKey(row);
        const occ = (inPageCounts.get(k) || 0) + 1;
        inPageCounts.set(k, occ);
        if (occ > 1) row._pageOccurrence = occ;
        allRecords.push(row);
      }

      const pct = Math.min(95, 40 + Math.round((Math.min(allRecords.length, totalCount) / totalCount) * 55));
      onProgress(
        pct,
        `4/4 拉取第 ${page} / ${totalPages} 页 · 已获取 ${allRecords.length} / ${totalCount} 条原始记录`
      );

      if (allRecords.length >= totalCount) break;
      page += 1;
      await sleep(PAGE_DELAY_MS);
    }

    onProgress(98, '正在关联首见地点并补全目/科/属/种与拉丁学名');
    return {
      account,
      z4TaxonList,
      groupBirds,
      outsideGroupBirds,
      timelineData,
      allRecords,
    };
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function buildFilename(account, suffix, ext) {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const safeAcc = (account || 'birdreport').replace(/[\\/:*?"<>|\s]+/g, '_');
    return `中国观鸟记录中心_${safeAcc}_${suffix}_${ymd}.${ext}`;
  }

  // =========================================================================
  // 6. HeroUI v3 (oklch tokens) + Unslop UI (Zero Emoji, Unified 16px SVG)
  // =========================================================================

  const ICONS = {
    bird: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
    switchUser: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>',
    logOut: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  };

  const SAVED_ACCOUNTS_KEY = '$brex_saved_accounts';

  function loadSavedAccounts() {
    try {
      const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((a) => a && a.token && (a.id || a.account)) : [];
    } catch (_) {
      return [];
    }
  }

  function persistSavedAccounts(list) {
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function rememberCurrentAccount(user) {
    if (!user || !user.token) return;
    const list = loadSavedAccounts();
    const uid = safeStr(user.id || user.account);
    const idx = list.findIndex((a) => safeStr(a.id || a.account) === uid);
    const entry = { ...user, _savedAt: Date.now() };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }
    persistSavedAccounts(list.slice(0, 10));
  }

  function switchToSavedAccount(targetId) {
    const list = loadSavedAccounts();
    const target = list.find((a) => safeStr(a.id || a.account) === safeStr(targetId));
    if (!target) return false;
    const cleanUser = { ...target };
    delete cleanUser._savedAt;
    localStorage.setItem('$user', JSON.stringify(cleanUser));
    cachedRawData = null;
    cachedOptionsKey = '';
    const nameEl = document.getElementById('username') || document.getElementById('userinfo');
    if (nameEl && cleanUser.account) nameEl.textContent = cleanUser.account;
    return true;
  }

  function removeSavedAccount(targetId) {
    const list = loadSavedAccounts().filter((a) => safeStr(a.id || a.account) !== safeStr(targetId));
    persistSavedAccounts(list);
  }

  function normalizeUserDateInput(val) {
    const s = safeStr(val);
    if (!s) return '';
    const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (!m) {
      throw new Error(`日期格式不正确（${s}），请输入如 2024-01-01 或留空`);
    }
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  let cachedRawData = null;
  let cachedOptionsKey = '';

  function injectStyles() {
    if (document.getElementById('brex-style')) return;
    const style = document.createElement('style');
    style.id = 'brex-style';
    style.textContent = `
      :root {
        --brex-bg: oklch(0.985 0.003 105);
        --brex-surface: oklch(1 0 0);
        --brex-surface-2: oklch(0.965 0.004 105);
        --brex-border: oklch(0.2 0.006 105 / 0.1);
        --brex-border-strong: oklch(0.2 0.006 105 / 0.18);
        --brex-fg: oklch(0.2 0.008 110);
        --brex-fg-secondary: oklch(0.45 0.008 110);
        --brex-fg-muted: oklch(0.58 0.006 110);
        --brex-accent: oklch(0.42 0.085 155);
        --brex-accent-hover: oklch(0.36 0.085 155);
        --brex-accent-fg: oklch(0.99 0 0);
        --brex-danger: oklch(0.52 0.16 25);
        --brex-warn: oklch(0.65 0.14 75);
        --brex-ring: oklch(0.42 0.085 155 / 0.32);
        --brex-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        --brex-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      #brex-fab {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 2147483640;
        height: 40px;
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid var(--brex-border-strong);
        background: var(--brex-surface);
        color: var(--brex-fg);
        font-family: var(--brex-font);
        font-size: 13px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        box-shadow: 0 2px 8px oklch(0.15 0 0 / 0.08), 0 1px 2px oklch(0.15 0 0 / 0.06);
        transition: background-color 140ms var(--brex-ease), border-color 140ms var(--brex-ease), transform 120ms var(--brex-ease);
      }
      #brex-fab:hover {
        background: var(--brex-surface-2);
        border-color: var(--brex-accent);
      }
      #brex-fab:active { transform: scale(0.98); }
      #brex-fab:focus-visible {
        outline: 2px solid var(--brex-ring);
        outline-offset: 2px;
      }
      #brex-fab .brex-fab-icon {
        color: var(--brex-accent);
        display: inline-flex;
      }

      #brex-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        background: oklch(0.15 0.005 110 / 0.42);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: var(--brex-font);
        box-sizing: border-box;
      }
      #brex-overlay.open { display: flex; }

      #brex-modal, #brex-modal * { box-sizing: border-box; }

      #brex-modal {
        width: 440px;
        max-width: 100%;
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        background: var(--brex-surface);
        color: var(--brex-fg);
        border-radius: 14px;
        box-shadow: 0 16px 40px oklch(0.15 0.005 110 / 0.16), 0 1px 4px oklch(0.15 0.005 110 / 0.08);
      }

      .brex-header {
        padding: 20px 20px 14px;
        border-bottom: 1px solid var(--brex-border);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .brex-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .brex-brand-icon {
        color: var(--brex-accent);
        display: inline-flex;
        flex-shrink: 0;
      }
      .brex-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
        color: var(--brex-fg);
      }
      .brex-sub {
        margin: 6px 0 0;
        font-size: 12px;
        font-weight: 400;
        color: var(--brex-fg-secondary);
        line-height: 1.45;
      }
      .brex-icon-btn {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--brex-fg-secondary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: background-color 140ms var(--brex-ease), color 140ms var(--brex-ease);
      }
      .brex-icon-btn:hover {
        background: var(--brex-surface-2);
        color: var(--brex-fg);
      }
      .brex-icon-btn:focus-visible {
        outline: 2px solid var(--brex-ring);
        outline-offset: 1px;
      }

      .brex-body {
        padding: 16px 20px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .brex-account-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }
      .brex-account-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .brex-account-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .brex-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--brex-accent);
        flex-shrink: 0;
      }
      .brex-dot.warn { background: var(--brex-warn); }
      .brex-dot.muted { background: var(--brex-fg-muted); }
      .brex-account-text {
        color: var(--brex-fg);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .brex-account-muted {
        color: var(--brex-fg-muted);
        font-weight: 400;
      }
      .brex-ghost-btn {
        border: none;
        background: transparent;
        color: var(--brex-fg-secondary);
        font-family: var(--brex-font);
        font-size: 12px;
        font-weight: 400;
        padding: 4px 6px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        text-decoration: none;
        transition: background-color 140ms var(--brex-ease), color 140ms var(--brex-ease);
      }
      .brex-ghost-btn:hover {
        background: var(--brex-surface-2);
        color: var(--brex-fg);
      }

      .brex-account-menu {
        display: none;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        border-radius: 8px;
        background: var(--brex-surface-2);
      }
      .brex-account-menu.open { display: flex; }
      .brex-account-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 12px;
        color: var(--brex-fg);
        cursor: pointer;
        transition: background-color 120ms var(--brex-ease);
      }
      .brex-account-item:hover {
        background: oklch(0.2 0.006 105 / 0.06);
      }
      .brex-account-item-main {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .brex-account-item-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .brex-account-tag {
        font-size: 11px;
        color: var(--brex-accent);
        flex-shrink: 0;
      }
      .brex-account-remove {
        border: none;
        background: transparent;
        color: var(--brex-fg-muted);
        width: 20px;
        height: 20px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        font-size: 14px;
        line-height: 1;
      }
      .brex-account-remove:hover {
        background: oklch(0.2 0.006 105 / 0.08);
        color: var(--brex-fg);
      }
      .brex-account-add {
        margin-top: 2px;
        padding: 6px 8px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--brex-fg-secondary);
        font-family: var(--brex-font);
        font-size: 12px;
        font-weight: 400;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        width: 100%;
        text-align: left;
        transition: background-color 120ms var(--brex-ease), color 120ms var(--brex-ease);
      }
      .brex-account-add:hover {
        background: oklch(0.2 0.006 105 / 0.06);
        color: var(--brex-fg);
      }

      #brex-modal label {
        margin: 0;
        font-weight: 400;
        font-size: 12px;
      }

      .brex-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .brex-label {
        font-size: 12px;
        font-weight: 400;
        color: var(--brex-fg-secondary);
        width: 56px;
        flex-shrink: 0;
        margin: 0;
      }
      .brex-date-inputs {
        flex: 1;
        min-width: 0;
        width: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 8px;
      }
      .brex-date-field {
        position: relative;
        min-width: 0;
        width: 100%;
      }
      .brex-input, .brex-select {
        height: 36px;
        border: none;
        border-radius: 8px;
        background: var(--brex-surface-2);
        color: var(--brex-fg);
        font-family: var(--brex-font);
        font-size: 12.5px;
        font-weight: 400;
        font-variant-numeric: tabular-nums;
      }
      .brex-input {
        width: 100%;
        min-width: 0;
        padding: 0 28px 0 10px;
      }
      .brex-cal-btn {
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--brex-fg-muted);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }
      .brex-cal-btn:hover {
        color: var(--brex-fg);
        background: oklch(0.2 0.006 105 / 0.06);
      }
      .brex-native-date {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
        border: none;
        padding: 0;
      }
      .brex-input:focus, .brex-select:focus {
        outline: 2px solid var(--brex-ring);
        background: var(--brex-surface);
      }
      .brex-date-sep {
        font-size: 12px;
        color: var(--brex-fg-muted);
      }
      .brex-select {
        flex: 1;
        min-width: 0;
        padding: 0 10px;
        cursor: pointer;
      }

      .brex-check {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 400;
        color: var(--brex-fg-secondary);
        cursor: pointer;
        user-select: none;
        padding-left: 64px;
        margin: 0;
      }
      .brex-check input[type="checkbox"] {
        width: 15px;
        height: 15px;
        margin: 0;
        accent-color: var(--brex-accent);
        cursor: pointer;
      }

      .brex-btn {
        height: 36px;
        padding: 0 18px;
        border-radius: 8px;
        font-family: var(--brex-font);
        font-size: 13px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        border: none;
        flex-shrink: 0;
        transition: background-color 140ms var(--brex-ease), transform 100ms var(--brex-ease), opacity 140ms var(--brex-ease);
      }
      .brex-btn:active:not(:disabled) { transform: scale(0.98); }
      .brex-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .brex-btn:focus-visible {
        outline: 2px solid var(--brex-ring);
        outline-offset: 2px;
      }
      .brex-btn-primary {
        background: var(--brex-accent);
        color: var(--brex-accent-fg);
      }
      .brex-btn-primary:hover:not(:disabled) {
        background: var(--brex-accent-hover);
      }

      .brex-progress-wrap {
        display: none;
        flex-direction: column;
        gap: 8px;
        padding-top: 4px;
      }
      .brex-progress-wrap.show { display: flex; }
      .brex-bar-track {
        height: 4px;
        border-radius: 4px;
        background: var(--brex-surface-2);
        overflow: hidden;
      }
      .brex-bar-fill {
        height: 100%;
        width: 0%;
        background: var(--brex-accent);
        transition: width 180ms var(--brex-ease);
      }
      .brex-status {
        font-size: 12px;
        color: var(--brex-fg-secondary);
        font-variant-numeric: tabular-nums;
        line-height: 1.45;
      }
      .brex-status.error { color: var(--brex-danger); }

      .brex-summary-line {
        display: none;
        font-size: 12.5px;
        color: var(--brex-fg-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow-x: auto;
        padding-top: 2px;
      }
      .brex-summary-line.show { display: block; }
      .brex-summary-line strong {
        color: var(--brex-fg);
        font-weight: 600;
      }
      .brex-summary-line .brex-accent-num {
        color: var(--brex-accent);
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);
  }

  function createModalIfNeeded() {
    if (document.getElementById('brex-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'brex-overlay';
    overlay.innerHTML = `
      <div id="brex-modal" role="dialog" aria-modal="true" aria-labelledby="brex-title">
        <div class="brex-header">
          <div>
            <div class="brex-brand">
              <span class="brex-brand-icon">${ICONS.bird}</span>
              <h3 class="brex-title" id="brex-title">观鸟记录导出</h3>
            </div>
            <p class="brex-sub">导出郑四首加时间线、全量原始记录、报告汇总与统计概览（含目科属种与拉丁学名）</p>
          </div>
          <button type="button" class="brex-icon-btn" id="brex-close" aria-label="关闭">${ICONS.close}</button>
        </div>

        <div class="brex-body">
          <div id="brex-account-bar" class="brex-account-bar"></div>
          <div id="brex-account-menu" class="brex-account-menu"></div>

          <div class="brex-row">
            <span class="brex-label">观测日期</span>
            <div class="brex-date-inputs">
              <div class="brex-date-field">
                <input type="text" id="brex-start" class="brex-input" placeholder="" maxlength="10" autocomplete="off" aria-label="开始日期" />
                <button type="button" class="brex-cal-btn" data-target="brex-start" title="选择开始日期" aria-label="选择开始日期">${ICONS.calendar}</button>
                <input type="date" class="brex-native-date" data-target="brex-start" tabindex="-1" aria-hidden="true" />
              </div>
              <span class="brex-date-sep">至</span>
              <div class="brex-date-field">
                <input type="text" id="brex-end" class="brex-input" placeholder="" maxlength="10" autocomplete="off" aria-label="结束日期" />
                <button type="button" class="brex-cal-btn" data-target="brex-end" title="选择结束日期" aria-label="选择结束日期">${ICONS.calendar}</button>
                <input type="date" class="brex-native-date" data-target="brex-end" tabindex="-1" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div class="brex-row">
            <label class="brex-label" for="brex-format">导出格式</label>
            <select id="brex-format" class="brex-select">
              <option value="xlsx">Excel (.xlsx · 含 4 张工作表)</option>
              <option value="csv">CSV (UTF-8 · 分表导出)</option>
              <option value="json">JSON (结构化备份)</option>
            </select>
            <button type="button" id="brex-export-btn" class="brex-btn brex-btn-primary">
              ${ICONS.download}
              <span>导出</span>
            </button>
          </div>

          <label class="brex-check">
            <input type="checkbox" id="brex-outside" />
            <span>包含名录外、分布外标红及逸出记录</span>
          </label>

          <div id="brex-progress-wrap" class="brex-progress-wrap">
            <div class="brex-bar-track"><div id="brex-bar-fill" class="brex-bar-fill"></div></div>
            <div id="brex-status" class="brex-status"></div>
          </div>

          <div id="brex-summary-line" class="brex-summary-line"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Date fields: keep visible inputs plain text (always blank unless chosen) & bind calendar button
    overlay.querySelectorAll('.brex-cal-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const textInput = document.getElementById(targetId);
        const nativeInput = btn.parentElement.querySelector('.brex-native-date');
        if (!textInput || !nativeInput) return;
        const val = safeStr(textInput.value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          nativeInput.value = val;
        }
        if (typeof nativeInput.showPicker === 'function') {
          try {
            nativeInput.showPicker();
            return;
          } catch (_) {}
        }
        nativeInput.focus();
        nativeInput.click();
      });
    });

    overlay.querySelectorAll('.brex-native-date').forEach((nativeInput) => {
      nativeInput.addEventListener('change', () => {
        const targetId = nativeInput.getAttribute('data-target');
        const textInput = document.getElementById(targetId);
        if (textInput && nativeInput.value) {
          textInput.value = nativeInput.value;
        }
      });
    });

    const close = () => overlay.classList.remove('open');
    overlay.querySelector('#brex-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    const setStatus = (pct, msg, isError = false) => {
      const wrap = document.getElementById('brex-progress-wrap');
      const fill = document.getElementById('brex-bar-fill');
      const status = document.getElementById('brex-status');
      wrap.classList.add('show');
      if (pct >= 0) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      status.className = isError ? 'brex-status error' : 'brex-status';
      status.textContent = msg;
    };

    const renderAccountMenu = (currentUser) => {
      const menu = document.getElementById('brex-account-menu');
      const accounts = loadSavedAccounts();
      const currentUid = currentUser ? safeStr(currentUser.id || currentUser.account) : '';

      const itemsHtml = accounts
        .map((acc) => {
          const uid = safeStr(acc.id || acc.account);
          const isActive = currentUser && uid === currentUid;
          const label = xmlEscape(acc.account || uid);
          return `
            <div class="brex-account-item" data-switch-id="${xmlEscape(uid)}">
              <div class="brex-account-item-main">
                <span class="brex-dot ${isActive ? '' : 'muted'}"></span>
                <span class="brex-account-item-name">${label}</span>
              </div>
              ${isActive ? '<span class="brex-account-tag">当前</span>' : `<button type="button" class="brex-account-remove" data-remove-id="${xmlEscape(uid)}" title="移除记录">×</button>`}
            </div>
          `;
        })
        .join('');

      menu.innerHTML = `
        ${itemsHtml}
        <button type="button" id="brex-login-other" class="brex-account-add">
          ${ICONS.logOut}
          <span>登录其他账号</span>
        </button>
      `;

      menu.querySelectorAll('.brex-account-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          if (e.target && e.target.closest('.brex-account-remove')) return;
          const uid = item.getAttribute('data-switch-id');
          if (currentUser && uid === currentUid) {
            menu.classList.remove('open');
            return;
          }
          if (switchToSavedAccount(uid)) {
            menu.classList.remove('open');
            document.getElementById('brex-summary-line').classList.remove('show');
            document.getElementById('brex-progress-wrap').classList.remove('show');
            refreshUserBar();
            const nextUser = getLoggedInUser();
            setStatus(0, `已切换至账号：${(nextUser && (nextUser.account || nextUser.id)) || uid}`);
          }
        });
      });

      menu.querySelectorAll('.brex-account-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeSavedAccount(btn.getAttribute('data-remove-id'));
          renderAccountMenu(getLoggedInUser());
        });
      });

      const loginOther = document.getElementById('brex-login-other');
      if (loginOther) {
        loginOther.addEventListener('click', () => {
          const cur = getLoggedInUser();
          if (cur) rememberCurrentAccount(cur);
          localStorage.removeItem('$user');
          location.href = '/member/login.html';
        });
      }
    };

    const refreshUserBar = () => {
      const user = getLoggedInUser();
      if (user) rememberCurrentAccount(user);
      const savedList = loadSavedAccounts();
      const bar = document.getElementById('brex-account-bar');
      const menu = document.getElementById('brex-account-menu');

      if (user) {
        bar.innerHTML = `
          <div class="brex-account-left">
            <span class="brex-dot"></span>
            <span class="brex-account-text">${xmlEscape(user.account || user.id)}</span>
            <span class="brex-account-muted">已登录</span>
          </div>
          <div class="brex-account-actions">
            <button type="button" id="brex-clear-cache" class="brex-ghost-btn" style="display:${cachedRawData ? 'inline-flex' : 'none'}">
              ${ICONS.refresh}
              <span>刷新</span>
            </button>
            <button type="button" id="brex-switch-btn" class="brex-ghost-btn">
              ${ICONS.switchUser}
              <span>切换账号</span>
            </button>
          </div>
        `;
        const clearBtn = document.getElementById('brex-clear-cache');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            cachedRawData = null;
            cachedOptionsKey = '';
            clearBtn.style.display = 'none';
            setStatus(0, '缓存已清除，下次导出将重新拉取');
          });
        }
      } else {
        bar.innerHTML = `
          <div class="brex-account-left">
            <span class="brex-dot warn"></span>
            <span class="brex-account-text">未登录</span>
          </div>
          <div class="brex-account-actions">
            ${savedList.length > 0 ? `<button type="button" id="brex-switch-btn" class="brex-ghost-btn">${ICONS.switchUser}<span>切换账号</span></button>` : ''}
            <a href="/member/login.html" class="brex-ghost-btn">前往登录</a>
          </div>
        `;
      }

      const switchBtn = document.getElementById('brex-switch-btn');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => {
          const isOpen = menu.classList.contains('open');
          if (!isOpen) renderAccountMenu(getLoggedInUser());
          menu.classList.toggle('open', !isOpen);
        });
      }
      if (menu.classList.contains('open')) renderAccountMenu(user);
    };

    const renderStats = (summary) => {
      const el = document.getElementById('brex-summary-line');
      el.innerHTML =
        `<strong>${summary.totalOrders}</strong> 目 · ` +
        `<strong>${summary.totalFamilies}</strong> 科 · ` +
        `<strong>${summary.totalGenera}</strong> 属 · ` +
        `<span class="brex-accent-num">${summary.totalSpecies}</span> 种 · ` +
        `<strong>${summary.totalReports}</strong> 报告 · ` +
        `<strong>${summary.totalRecords}</strong> 记录`;
      el.classList.add('show');
    };

    const runExport = async () => {
      refreshUserBar();
      const user = getLoggedInUser();
      if (!user) {
        setStatus(0, '请先登录中国观鸟记录中心后再导出', true);
        return;
      }

      const format = document.getElementById('brex-format').value;
      const includeOutside = document.getElementById('brex-outside').checked;

      const exportBtn = document.getElementById('brex-export-btn');
      exportBtn.disabled = true;
      try {
        const startDate = normalizeUserDateInput(document.getElementById('brex-start').value);
        const endDate = normalizeUserDateInput(document.getElementById('brex-end').value);
        const optsKey = JSON.stringify({ user: user.id, startDate, endDate, includeOutside });

        if (!cachedRawData || cachedOptionsKey !== optsKey) {
          cachedRawData = await fetchAllUserData(
            { startDate, endDate, includeOutside },
            (pct, text) => setStatus(pct, text)
          );
          cachedOptionsKey = optsKey;
          refreshUserBar();
        } else {
          setStatus(96, '使用本次会话缓存生成文件');
        }

        const dataset = buildExportDataset({
          ...cachedRawData,
          sortOrder: 'asc',
          includeOutside,
        });

        renderStats(dataset.summary);

        if (format === 'xlsx') {
          const bytes = buildXlsxBytes(dataset);
          const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          triggerDownload(blob, buildFilename(dataset.summary.account, '郑四总鸟种与全量记录', 'xlsx'));
          setStatus(100, '已导出 Excel (.xlsx)');
        } else if (format === 'csv') {
          const csvSpecies = buildCsvString(SPECIES_COLUMNS, dataset.speciesTimeline);
          triggerDownload(
            new Blob([csvSpecies], { type: 'text/csv;charset=utf-8' }),
            buildFilename(dataset.summary.account, '郑四总鸟种首加时间线', 'csv')
          );
          await sleep(250);
          const csvRecords = buildCsvString(RECORD_COLUMNS, dataset.records);
          triggerDownload(
            new Blob([csvRecords], { type: 'text/csv;charset=utf-8' }),
            buildFilename(dataset.summary.account, '全部观鸟记录明细', 'csv')
          );
          await sleep(250);
          const csvReports = buildCsvString(REPORT_COLUMNS, dataset.reports);
          triggerDownload(
            new Blob([csvReports], { type: 'text/csv;charset=utf-8' }),
            buildFilename(dataset.summary.account, '观鸟报告汇总', 'csv')
          );
          setStatus(100, '已导出 3 份 UTF-8 CSV');
        } else if (format === 'json') {
          const jsonStr = JSON.stringify(dataset, null, 2);
          triggerDownload(
            new Blob([jsonStr], { type: 'application/json;charset=utf-8' }),
            buildFilename(dataset.summary.account, '全量观鸟数据备份', 'json')
          );
          setStatus(100, '已导出 JSON');
        }
      } catch (err) {
        console.error('[BirdReportExport]', err);
        setStatus(0, `导出失败：${err && err.message ? err.message : String(err)}`, true);
      } finally {
        exportBtn.disabled = false;
      }
    };

    document.getElementById('brex-export-btn').addEventListener('click', runExport);

    overlay._refreshUserBar = refreshUserBar;
  }

  function openModal() {
    injectStyles();
    createModalIfNeeded();
    const overlay = document.getElementById('brex-overlay');
    if (overlay._refreshUserBar) overlay._refreshUserBar();
    overlay.classList.add('open');
  }

  function mountFab() {
    if (window.self !== window.top) return;
    injectStyles();
    createModalIfNeeded();
    if (document.getElementById('brex-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'brex-fab';
    btn.type = 'button';
    btn.innerHTML = `<span class="brex-fab-icon">${ICONS.download}</span><span>导出观鸟数据</span>`;
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }

  global.__BIRDREPORT_EXPORTER__ = {
    openModal,
    mountFab,
    buildExportDataset,
    buildXlsxBytes,
    buildCsvString,
  };

  const init = () => {
    mountFab();
    if (global.__BREX_AUTO_OPEN__) openModal();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
