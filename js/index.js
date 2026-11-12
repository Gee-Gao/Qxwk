// ============ 数据与状态 ============
const DEFAULTS = {
  companyName: '',           // 当前公司名称，归档时作为历史工作名称
  monthlySalary: 3000,       // 税前月薪
  salaryMode: 'gross',       // 工资口径：gross 只统计税前 / net 统计税后到手 / compare 统计税后并并列展示税前对照
  socialBase: 0,             // 社保缴费基数，0 表示按税前月薪
  fundBase: 0,               // 公积金缴费基数，0 表示按税前月薪
  pensionRate: 8,            // 养老保险个人比例（%）
  medicalRate: 2,            // 医疗保险个人比例（%）
  unemploymentRate: 0.5,     // 失业保险个人比例（%）
  fundRate: 12,              // 住房公积金个人比例（%）
  medicalExtra: 0,           // 大额医疗互助个人固定金额（元/月），部分城市按「医疗 2% + 3 元」缴纳
  workDaysPerMonth: 22,
  hireDate: '',           // 入职日期，用于生命消耗大盘 + 自动计算转正日期
  probationMonths: 3,     // 试用期月数，留空/0 表示无试用期
  regularDate: '',        // 转正日期（兼容旧数据：仅入职日期+试用期未设置时使用），留空表示无试用期
  probationRatio: 80,     // 试用期薪资比例（%），按正式期月薪折算
  workDayMode: 'double',
  customWorkMonth: '',     // 自定义日历生效的月份（YYYY-MM）
  customWorkDates: [],     // 该月上班的具体日期（YYYY-MM-DD），空表示未选择，按双休计算
  customWorkdayPromptMonth: '', // 最近一次自动弹窗的月份（YYYY-MM），用于每月只弹一次
  bigSmallWeekStart: '',  // 大小周基准周的周一日期，与 bigSmallWeekType 一起确定每周类型
  bigSmallWeekType: 'big', // 基准周类型：big 双休周（大周）/ small 单休周（小周）
  workedDaysDecimals: 0, // 已工作天数小数位：0 今天按整天计 / 1、2 今天按已工作时长折算并保留对应位数
  startTime: '09:00',
  endTime: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  commuteMinutes: 0,      // 每日通勤合计（分钟，往返）；纳入时薪时按往返各半拆分
  commuteInputMode: 'total', // 通勤计时方式：total 一天合计自动÷2 / split 往返分开填
  commuteMorning: 0,      // 早通勤（去程，分钟），仅 split 模式使用
  commuteEvening: 0,      // 晚通勤（返程，分钟），仅 split 模式使用
  commuteInHourly: false, // 通勤时间是否纳入时薪折算
  overtimeSettle: 'money', // 加班结算方式：money 给钱 / leave 调休
  overtimeSync: false,     // 加班金额是否计入计时页（仅给钱模式有效）
  overtimePanelShow: 'always', // 计时页加班费卡片展示：always 始终展示 / auto 无数据不展示 / off 隐藏
  foreignEnabled: false,   // 计时页是否附加展示外币换算
  foreignCurrency: 'USD'   // 外币换算币种代码
};

// 专项附加扣除分项（元/月），key 同时用作设置页输入框 id
const SPECIAL_ITEMS = [
  { key: 'specialChild',     label: '子女教育' },
  { key: 'specialBaby',      label: '3岁以下婴幼儿照护' },
  { key: 'specialEducation', label: '继续教育' },
  { key: 'specialLoan',      label: '住房贷款利息' },
  { key: 'specialRent',      label: '住房租金' },
  { key: 'specialElder',     label: '赡养老人' }
];
SPECIAL_ITEMS.forEach(it => { DEFAULTS[it.key] = 0; });

const QUOTES = [
  '下班不是奖励，是应得。',
  '摸鱼不是偷懒，是拿回属于你的时间。',
  '你卖的不是时间，是生命。',
  '上班如上坟，下班如出狱。',
  '工资到账的那天，是一月中最快乐的一天。',
  '不是工作需要你，是你需要工资。',
  '打工人的快乐，就是发工资和下班。',
  '每一分钟的摸鱼，都是对资本的微小胜利。',
  '上班痛苦没有关系，下班快乐就好。',
  '你的时间很贵，别浪费在不值得的事情上。'
];

let settings = {};
let devices = [];
const MAX_DEVICES = 10;
let paidLeaveSessions = [];
let calcMode = 'slack'; // 反向计算器模式：slack 摸鱼白拿 / goal 熬班换钱
let paidLeaveActive = false;
let paidLeaveStart = null;
let overtimeRecords = [];  // 加班记录
let leaveUsedRecords = []; // 已调休记录（调休模式下用来抵扣加班时长）
let overtimeUnit = 'hour'; // 录入时长单位：hour 小时 / day 天
let overtimeRateMode = '1.5'; // 录入倍率档位：'1.5' | '2' | '3' | 'custom'
let leaveUnit = 'hour';    // 调休录入时长单位：hour 小时 / day 天
let recordType = 'overtime'; // 「记一笔」卡片的记录类型：overtime 记加班 / leave 记调休
let recordFilter = 'all';   // 记录列表筛选：all 全部 / overtime 只看加班 / leave 只看调休
let ledgerRecords = [];       // 记账记录
let ledgerCategories = [];    // 自定义记账项目
let ledgerMonth = '';         // 记账/统计页当前月份（YYYY-MM）
let ledgerViewDate = '';      // 记账页当前选中的日期（YYYY-MM-DD）
let ledgerStatsScope = 'month'; // 图表统计范围：month 月度 / year 年度累计
let ledgerPickerYear = 0;     // 月份快速选择弹窗当前显示的年份
let ledgerDate = '';          // 当前正在记账的日期（YYYY-MM-DD）
let ledgerEditingId = null;   // 为空表示新增，否则为正在修改的记录编号
let ledgerSelectedCategory = '';
let ledgerCustomIcon = '🏷️';

// ============ 历史工作 ============
// 历史工作保存与当前工作完全一致的工作参数快照；
// 工资口径、外币、已工作天数小数位等属于全局展示偏好，不随某一段工作单独保存
const JOB_HISTORY_KEY = 'qianxwk_job_history';
const JOB_FIELDS = [
  'monthlySalary',
  'socialBase', 'fundBase', 'pensionRate', 'medicalRate', 'unemploymentRate', 'fundRate', 'medicalExtra',
  'specialChild', 'specialBaby', 'specialEducation', 'specialLoan', 'specialRent', 'specialElder',
  'hireDate', 'probationMonths', 'regularDate', 'probationRatio',
  'workDayMode', 'workDaysPerMonth', 'customWorkMonth', 'customWorkDates',
  'bigSmallWeekStart', 'bigSmallWeekType',
  'startTime', 'endTime', 'lunchStart', 'lunchEnd',
  'commuteMinutes', 'commuteInputMode', 'commuteMorning', 'commuteEvening', 'commuteInHourly'
];
let jobHistory = [];      // 历史工作列表（每项含 name / endDate / id + 工作参数快照）
let jobModalDraft = null; // 历史工作弹窗中正在编辑的草稿
let jobModalIsNew = false; // 当前弹窗是否为新增

// ============ 持久化 ============
function load() {
  try {
    settings = JSON.parse(localStorage.getItem('qianxwk_settings')) || {...DEFAULTS};
    devices = JSON.parse(localStorage.getItem('qianxwk_devices')) || [];
    paidLeaveSessions = JSON.parse(localStorage.getItem('qianxwk_leave')) || [];
    overtimeRecords = JSON.parse(localStorage.getItem('qianxwk_overtime')) || [];
    leaveUsedRecords = JSON.parse(localStorage.getItem('qianxwk_leave_used')) || [];
    ledgerRecords = JSON.parse(localStorage.getItem('qianxwk_ledger_records')) || [];
    ledgerCategories = JSON.parse(localStorage.getItem('qianxwk_ledger_categories')) || [];
    jobHistory = JSON.parse(localStorage.getItem(JOB_HISTORY_KEY)) || [];
  } catch(e) {
    settings = {...DEFAULTS};
    devices = [];
    paidLeaveSessions = [];
    overtimeRecords = [];
    leaveUsedRecords = [];
    ledgerRecords = [];
    ledgerCategories = [];
    jobHistory = [];
  }
  if (!Array.isArray(ledgerRecords)) ledgerRecords = [];
  if (!Array.isArray(ledgerCategories)) ledgerCategories = [];
  if (!Array.isArray(jobHistory)) jobHistory = [];
  normalizeJobHistory();
  // 兼容旧版「整天/小数」开关：小数 -> 1 位，其余（整天/未设置）-> 0 位
  if (settings.workedDaysDecimals === undefined) {
    settings.workedDaysDecimals = settings.workedDaysMode === 'decimal' ? 1 : 0;
  }
  for (const k in DEFAULTS) {
    if (settings[k] === undefined || settings[k] === '') settings[k] = DEFAULTS[k];
  }
  // 自定义日历：月份非法或与日期不匹配时按「未选择」处理
  if (!/^\d{4}-\d{2}$/.test(settings.customWorkMonth || '')) settings.customWorkMonth = '';
  if (!Array.isArray(settings.customWorkDates)) settings.customWorkDates = [];
  if (!settings.customWorkMonth) {
    settings.customWorkDates = [];
  } else {
    settings.customWorkDates = [...new Set(settings.customWorkDates
      .filter(k => typeof k === 'string' && k.slice(0, 7) === settings.customWorkMonth))].sort();
  }
}

// ---------- 工作经历：快照与时间轴 ----------
function newJobId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// 从当前工作或任意工作对象中提取工作参数快照
function snapshotJob(source) {
  const src = source || settings;
  const job = {};
  JOB_FIELDS.forEach(k => {
    job[k] = Array.isArray(src[k]) ? [...src[k]] : src[k];
  });
  return job;
}

// 兼容旧数据：补齐缺失字段、标准化字段类型
function normalizeJobHistory() {
  jobHistory = jobHistory
    .filter(o => o && typeof o === 'object')
    .map(o => {
      const job = snapshotJob({ ...DEFAULTS, ...o });
      job.id = typeof o.id === 'string' && o.id ? o.id : newJobId();
      job.name = typeof o.name === 'string' ? o.name : '';
      job.endDate = typeof o.endDate === 'string' ? o.endDate : '';
      if (!Array.isArray(job.customWorkDates)) job.customWorkDates = [];
      return job;
    });
}

function saveJobHistory() {
  try { localStorage.setItem(JOB_HISTORY_KEY, JSON.stringify(jobHistory)); } catch (e) { /* 写入失败不影响使用 */ }
}

// 某段工作的转正日期：优先由入职日期 + 试用期月数计算
function getRegularDateOf(job) {
  const cfg = job || settings;
  const hire = cfg.hireDate || '';
  if (hire) {
    const months = parseFloat(cfg.probationMonths);
    if (!isNaN(months) && months > 0) return addMonths(hire, months);
    return '';
  }
  return cfg.regularDate || '';
}

function jobKeyOf(job) {
  return job === settings ? 'current' : (job && job.id) || 'job';
}

// 某段工作是否覆盖指定日期；未填入职日期的当前工作沿用旧口径（视为全年在职）
function jobCoversDate(job, date) {
  if (!job) return false;
  const hire = parseDateKey(job.hireDate || '');
  if (job === settings && !hire) return true;
  if (!hire || date < hire) return false;
  if (job === settings) return true;
  const end = parseDateKey(job.endDate || '');
  return !end || date <= end;
}

// 指定日期所属的工作：历史工作优先（入职更晚者优先），都没有时回落到当前工作
function jobOnDate(date) {
  let picked = null;
  let pickedHire = null;
  jobHistory.forEach(job => {
    if (!jobCoversDate(job, date)) return;
    const hire = parseDateKey(job.hireDate || '');
    if (!picked || (hire && (!pickedHire || hire > pickedHire))) {
      picked = job;
      pickedHire = hire;
    }
  });
  if (picked) return picked;
  return jobCoversDate(settings, date) ? settings : null;
}

// 时间轴上的全部工作：历史工作 + 当前工作
function getAllJobs() {
  return jobHistory.concat([settings]);
}

// 指定日期适用的时薪（用于历史加班、按日收入等），grossOnly 时取税前口径
function hourlyRateForDate(dateKey, grossOnly) {
  const d = parseDateKey(dateKey);
  if (!d) return grossOnly ? getGrossHourlyRate() : getHourlyRate();
  const job = jobOnDate(d);
  if (!job) return grossOnly ? getGrossHourlyRate() : getHourlyRate();
  return jobHourlyAt(job, d, grossOnly);
}

// 工作参数变化后清空按工作/月份缓存的薪资结果
let jobPayCache = new Map();
function invalidateJobCaches() {
  jobPayCache = new Map();
  hourlyTrendSig = '';
}

function selectWorkDayMode(mode, openPicker) {
  settings.workDayMode = mode;
  const input = document.getElementById('workDaysPerMonth');
  const hint = document.getElementById('workDaysHint');
  if (mode === 'custom') {
    // 自定义：每月工作天数由当月日历自动计算，不允许手改
    const days = autoWorkDaysPerMonth('custom');
    input.value = days;
    settings.workDaysPerMonth = days;
    input.disabled = true;
    if (hint) {
      hint.textContent = hasCustomWorkDatesFor(settings, currentMonthKey())
        ? `按本月日历自动计算：本月 ${days} 天上班`
        : '未调整本月日历，暂按双休（周一至周五）自动计算';
    }
    if (openPicker) openCustomWorkdayModal();
  } else {
    // 双休/单休/大小周：按当月实际工作日自动取值，不允许手改
    const days = autoWorkDaysPerMonth(mode);
    input.value = days;
    settings.workDaysPerMonth = days; // 同步统计口径，避免展示与实际计算不一致
    input.disabled = true;
    if (hint) hint.textContent = '自动计算，已含法定节假日与调休补班';
  }
  const modeHint = document.getElementById('workDayModeHint');
  if (modeHint) {
    modeHint.textContent = mode === 'bigsmall'
      ? '双休周与单休周每周交替，先在下方确认本周类型'
      : '';
  }
  // 首次切到大小周时，以当前周作为基准周
  if (mode === 'bigsmall' && !settings.bigSmallWeekStart) {
    settings.bigSmallWeekStart = fmtDateKey(weekStart(new Date()));
  }
  const group = document.getElementById('bigSmallWeekGroup');
  if (group) group.style.display = mode === 'bigsmall' ? '' : 'none';
  if (mode === 'bigsmall') renderBigSmallWeek();
  document.querySelectorAll('#workDayMode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
}

// ============ 自定义工作日（当月日历） ============
let customCalendarMonth = ''; // 弹窗展示的月份（YYYY-MM）
let customDateDraft = null;   // 弹窗内临时选择（Set<YYYY-MM-DD>）

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthKey() {
  return monthKeyOf(new Date());
}

// 指定月度配置是否已有自定义日历（无则按双休兜底）
function hasCustomWorkDatesFor(cfg, monthKey) {
  const mk = monthKey || currentMonthKey();
  return cfg.customWorkMonth === mk
    && Array.isArray(cfg.customWorkDates)
    && cfg.customWorkDates.length > 0;
}

// 当前工作的自定义日历判断
function hasCustomWorkDates(monthKey) {
  return hasCustomWorkDatesFor(settings, monthKey);
}

// 按双休预填某月上班日（法定节假日除外，调休补班计入）
function defaultWorkDatesOfMonth(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  const list = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(year, month, i);
    if (isWorkday(d, 'double')) list.push(fmtDateKey(d));
  }
  return list;
}

// 打开弹窗：已保存过本月则带入，否则按双休预填
function openCustomWorkdayModal() {
  const now = new Date();
  const job = settings;
  customCalendarMonth = monthKeyOf(now);
  const seed = hasCustomWorkDatesFor(job, customCalendarMonth)
    ? job.customWorkDates
    : defaultWorkDatesOfMonth(now.getFullYear(), now.getMonth());
  customDateDraft = new Set(seed);
  renderCustomCalendar();
  document.getElementById('customWorkdayModal').classList.add('show');
}

function closeCustomWorkdayModal() {
  const overlay = document.getElementById('customWorkdayModal');
  if (overlay) overlay.classList.remove('show');
  customDateDraft = null;
  customCalendarMonth = '';
}

function renderCustomCalendar() {
  const grid = document.getElementById('customCalendarGrid');
  const title = document.getElementById('customCalendarTitle');
  if (!grid || !customDateDraft || !customCalendarMonth) return;

  const [y, m] = customCalendarMonth.split('-').map(Number);
  if (title) title.textContent = `${y} 年 ${m} 月`;

  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 周一排第一列
  const days = new Date(y, m, 0).getDate();
  let html = '';
  for (let i = 0; i < offset; i++) html += '<span class="cal-day empty"></span>';
  for (let day = 1; day <= days; day++) {
    const key = `${customCalendarMonth}-${String(day).padStart(2, '0')}`;
    const work = customDateDraft.has(key);
    html += `<button type="button" class="cal-day${work ? ' work' : ''}" data-date="${key}" onclick="toggleCustomDate('${key}')">
      <span class="cal-num">${day}</span>
      <span class="cal-tag">${work ? '班' : '休'}</span>
    </button>`;
  }
  grid.innerHTML = html;
  updateCustomWorkdayHint();
}

function updateCustomWorkdayHint() {
  const hint = document.getElementById('customWorkdayHint');
  if (!hint || !customDateDraft) return;
  hint.textContent = customDateDraft.size
    ? `本月上班 ${customDateDraft.size} 天 · 每月工作天数将同步为 ${customDateDraft.size}`
    : '至少选择一天上班；未选择时按双休（周一至周五）计算';
}

function toggleCustomDate(key) {
  if (!customDateDraft) return;
  if (customDateDraft.has(key)) customDateDraft.delete(key);
  else customDateDraft.add(key);
  renderCustomCalendar();
}

// 保存本月具体上班日期，月工作天数自动同步
function saveCustomCalendar() {
  if (!customDateDraft || !customDateDraft.size) {
    showToast('至少选择一天上班');
    return;
  }
  settings.workDayMode = 'custom';
  settings.customWorkMonth = customCalendarMonth || currentMonthKey();
  settings.customWorkDates = [...customDateDraft].sort();
  settings.customWorkdayPromptMonth = settings.customWorkMonth;
  const days = customDateDraft.size;
  settings.workDaysPerMonth = days;
  const input = document.getElementById('workDaysPerMonth');
  if (input) input.value = days;
  persistSettings();
  closeCustomWorkdayModal();
  selectWorkDayMode('custom');
  updateAll();
}

// 自定义模式下每月自动弹窗一次；未选择时保持双休兜底
function maybePromptCustomWorkday() {
  if (settings.workDayMode !== 'custom') return;
  const mk = currentMonthKey();
  if (settings.customWorkdayPromptMonth === mk) return;
  settings.customWorkdayPromptMonth = mk;
  try { localStorage.setItem('qianxwk_settings', JSON.stringify(settings)); } catch (e) { /* 写入失败不影响使用 */ }
  openCustomWorkdayModal();
}

// ============ 统一日期 / 时间选择器 ============
// 用同一套自定义弹层替代浏览器原生 date/time 控件，保证各浏览器表现一致
let pickerTarget = null;
let pickerMode = 'date';
let pickerSelected = '';
let pickerViewYear = 0;
let pickerViewMonth = 0;

function pickerPad(n) {
  return String(n).padStart(2, '0');
}

function openPickerForInput(input) {
  if (!input || input.disabled) return;
  pickerTarget = input;
  pickerMode = input.dataset.picker === 'time' ? 'time' : 'date';
  const raw = (input.value || '').trim();

  if (pickerMode === 'date') {
    const d = parseDateKey(raw) || new Date();
    pickerSelected = fmtDateKey(d);
    pickerViewYear = d.getFullYear();
    pickerViewMonth = d.getMonth();
    document.getElementById('pickerTitle').textContent = '选择日期';
    document.getElementById('pickerDateView').style.display = '';
    document.getElementById('pickerTimeView').style.display = 'none';
    renderPickerDate();
  } else {
    const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
    const now = new Date();
    const h = m ? Math.min(23, parseInt(m[1], 10)) : now.getHours();
    const min = m ? Math.min(59, parseInt(m[2], 10)) : now.getMinutes();
    pickerSelected = `${pickerPad(h)}:${pickerPad(min)}`;
    document.getElementById('pickerTitle').textContent = '选择时间';
    document.getElementById('pickerDateView').style.display = 'none';
    document.getElementById('pickerTimeView').style.display = '';
    renderPickerTime();
  }

  const overlay = document.getElementById('pickerModal');
  overlay.classList.add('show');
  overlay.scrollTop = 0;
}

function renderPickerDate() {
  document.getElementById('pickerMonthLabel').textContent = `${pickerViewYear} 年 ${pickerViewMonth + 1} 月`;
  const offset = (new Date(pickerViewYear, pickerViewMonth, 1).getDay() + 6) % 7;
  const days = new Date(pickerViewYear, pickerViewMonth + 1, 0).getDate();
  const todayKey = fmtDateKey(new Date());
  const maxKey = pickerTarget ? pickerTarget.getAttribute('max') : '';
  const maxDate = parseDateKey(maxKey);
  let html = '';
  for (let i = 0; i < offset; i++) html += '<span class="cal-day empty"></span>';
  for (let day = 1; day <= days; day++) {
    const key = `${pickerViewYear}-${pickerPad(pickerViewMonth + 1)}-${pickerPad(day)}`;
    const dayDate = new Date(pickerViewYear, pickerViewMonth, day);
    const disabled = maxDate && dayDate > maxDate;
    const cls = ['cal-day'];
    if (key === pickerSelected) cls.push('selected');
    if (key === todayKey) cls.push('today');
    html += `<button type="button" class="${cls.join(' ')}"${disabled ? ' disabled' : ''} onclick="selectPickerDay('${key}')">
      <span class="cal-num">${day}</span>
    </button>`;
  }
  document.getElementById('pickerGrid').innerHTML = html;
}

function selectPickerDay(key) {
  pickerSelected = key;
  renderPickerDate();
}

function shiftPickerMonth(delta) {
  const d = new Date(pickerViewYear, pickerViewMonth + delta, 1);
  pickerViewYear = d.getFullYear();
  pickerViewMonth = d.getMonth();
  renderPickerDate();
}

function shiftPickerYear(delta) {
  pickerViewYear += delta;
  renderPickerDate();
}

function pickToday() {
  const now = new Date();
  pickerSelected = fmtDateKey(now);
  pickerViewYear = now.getFullYear();
  pickerViewMonth = now.getMonth();
  renderPickerDate();
}

function clearPicker() {
  pickerSelected = '';
  renderPickerDate();
}

function renderPickerTime() {
  const parts = pickerSelected.split(':');
  const hour = parseInt(parts[0], 10) || 0;
  const minute = parseInt(parts[1], 10) || 0;
  let hours = '';
  for (let i = 0; i < 24; i++) {
    hours += `<button type="button" data-hour="${i}" class="${i === hour ? 'active' : ''}" onclick="selectPickerHour(${i})">${pickerPad(i)}</button>`;
  }
  let minutes = '';
  for (let i = 0; i < 60; i++) {
    minutes += `<button type="button" data-minute="${i}" class="${i === minute ? 'active' : ''}" onclick="selectPickerMinute(${i})">${pickerPad(i)}</button>`;
  }
  document.getElementById('pickerHours').innerHTML = hours;
  document.getElementById('pickerMinutes').innerHTML = minutes;
  requestAnimationFrame(() => {
    centerPickerCol('pickerHours');
    centerPickerCol('pickerMinutes');
  });
}

// 只更新选中态，不重绘列表，避免每次选择后滚动位置被重置到顶部
function updatePickerTimeActive() {
  const parts = pickerSelected.split(':');
  const hour = parseInt(parts[0], 10) || 0;
  const minute = parseInt(parts[1], 10) || 0;
  document.querySelectorAll('#pickerHours button').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.hour, 10) === hour);
  });
  document.querySelectorAll('#pickerMinutes button').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.minute, 10) === minute);
  });
}

function centerPickerCol(id) {
  const col = document.getElementById(id);
  if (!col) return;
  const active = col.querySelector('button.active');
  if (!active) return;
  // 用相对列顶部的位置计算，避免 offsetTop 受其它定位父级影响
  const colRect = col.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  col.scrollTop += activeRect.top - colRect.top - (col.clientHeight - activeRect.height) / 2;
}

function selectPickerHour(hour) {
  const minute = pickerSelected.split(':')[1] || '00';
  pickerSelected = `${pickerPad(hour)}:${minute}`;
  updatePickerTimeActive();
}

function selectPickerMinute(minute) {
  const hour = pickerSelected.split(':')[0] || '00';
  pickerSelected = `${hour}:${pickerPad(minute)}`;
  updatePickerTimeActive();
}

function pickNowTime() {
  const now = new Date();
  pickerSelected = `${pickerPad(now.getHours())}:${pickerPad(now.getMinutes())}`;
  updatePickerTimeActive();
  requestAnimationFrame(() => {
    centerPickerCol('pickerHours');
    centerPickerCol('pickerMinutes');
  });
}

function confirmPicker() {
  if (!pickerTarget) return;
  const value = pickerMode === 'date'
    ? (pickerSelected ? formatDateSlash(pickerSelected) : '')
    : pickerSelected;
  pickerTarget.value = value;
  pickerTarget.dispatchEvent(new Event('input', { bubbles: true }));
  pickerTarget.dispatchEvent(new Event('change', { bubbles: true }));
  closePicker();
}

function closePicker() {
  const overlay = document.getElementById('pickerModal');
  if (overlay) overlay.classList.remove('show');
  pickerTarget = null;
}

// 取某天所在自然周的周一（零点），用于大小周按周交替
function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// 大小周：以基准周（bigSmallWeekStart）的类型为锚点，按相隔周数奇偶交替
function bigSmallWeekTypeOf(date, cfg) {
  const job = cfg || settings;
  const anchorKey = job.bigSmallWeekStart;
  if (!anchorKey) return job.bigSmallWeekType === 'small' ? 'small' : 'big';
  const anchor = new Date(anchorKey + 'T00:00:00');
  if (isNaN(anchor.getTime())) return 'big';
  const base = job.bigSmallWeekType === 'small' ? 'small' : 'big';
  const weeks = Math.round((weekStart(date) - weekStart(anchor)) / (7 * 86400000));
  return ((weeks % 2) + 2) % 2 === 0 ? base : (base === 'big' ? 'small' : 'big');
}

// 把「本周类型」控件同步为当前编辑工作的推导结果
function renderBigSmallWeek() {
  const type = bigSmallWeekTypeOf(new Date(), settings);
  document.querySelectorAll('#bigSmallWeekType .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.week === type);
  });
  const hint = document.getElementById('bigSmallWeekHint');
  if (hint) {
    hint.textContent = type === 'big'
      ? '本周双休（大周），下周单休，依次交替'
      : '本周单休（小周），下周双休，依次交替';
  }
}

// 以「本周」为基准记录大/小周，后续每周自动交替
function selectBigSmallWeek(type) {
  const job = settings;
  job.bigSmallWeekStart = fmtDateKey(weekStart(new Date()));
  job.bigSmallWeekType = type === 'small' ? 'small' : 'big';
  renderBigSmallWeek();
}

// 已工作天数小数位：0 整数（今天按一整天计）/ 1、2 按已工作时长折算并保留对应位数
function selectWorkedDaysDecimals(n) {
  settings.workedDaysDecimals = n;
  document.querySelectorAll('#workedDaysDecimals .seg-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.decimals, 10) === n);
  });
  const hint = document.getElementById('workedDaysDecimalsHint');
  if (hint) {
    hint.textContent = n === 0
      ? '今天一律按一整天计入，只显示整天数'
      : `今天按已工作时长折算，最多保留 ${n} 位小数，随计时实时增长`;
  }
}

function selectSalaryMode(mode) {
  settings.salaryMode = mode;
  invalidateJobCaches();
  document.querySelectorAll('#salaryMode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  // 税前口径不做任何扣除；税后与对比口径都按参数折算到手金额，需要展开缴费参数
  const needsTaxParams = mode !== 'gross';
  const taxCard = document.getElementById('taxCard');
  if (taxCard) taxCard.style.display = needsTaxParams ? '' : 'none';
  const modeHint = document.getElementById('salaryModeHint');
  if (modeHint) {
    if (mode === 'net') {
      modeHint.textContent = '统计按下方参数算出的税后到手金额';
    } else if (mode === 'compare') {
      modeHint.textContent = '统计口径为税后到手，首页额外并列展示税前金额以便对照';
    } else {
      modeHint.textContent = '只统计税前数据，不做五险一金与个税扣除';
    }
  }
}

// 当前月的到手明细：当月五险一金、累计预扣个税与累计已缴
function currentMonthTax(p) {
  const rows = buildMonthlySchedule(p);
  const month = new Date().getMonth();
  return rows.find(r => r.month === month) || rows[rows.length - 1];
}

// 月份加法：按 yyyy-MM-dd 本地日期计算，避免时区与月底溢出（如 1月31日 + 1月 → 2月28/29日）
// 支持小数月（如 3.5）：小数部分按目标月天数比例折算成天数
function addMonths(dateStr, months) {
  if (!dateStr) return '';
  const m = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(dateStr);
  if (!m) return '';
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const whole = Math.floor(months);
  const frac = months - whole;
  // 先定位到目标月 1 号
  const base = new Date(year, month + whole, 1);
  const targetYear = base.getFullYear();
  const targetMonth = base.getMonth();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  // 日对齐：原日期夹逼到目标月最后一天，再加上小数月折算的天数
  let targetDay = Math.min(day, daysInTargetMonth) + Math.round(frac * daysInTargetMonth);
  const result = new Date(targetYear, targetMonth, targetDay);
  const y = result.getFullYear();
  const mo = String(result.getMonth() + 1).padStart(2, '0');
  const da = String(result.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// 转正日期：优先由「入职日期 + 试用期月数」自动计算；
// 若已填入职日期但试用期月数<=0，则无试用期（直接正式）；
// 仅当未填入职日期时，兼容旧数据返回旧 regularDate
function getRegularDate() {
  return getRegularDateOf(settings);
}

// 入职日期 / 试用期月数变化时：重算转正日期、同步试用期比例可用状态、刷新提示
function onProbationParamsChange() {
  const job = settings;
  const hireInput = document.getElementById('hireDate');
  const monthsInput = document.getElementById('probationMonths');
  const regularInput = document.getElementById('regularDate');
  if (hireInput) job.hireDate = hireInput.value || '';
  if (monthsInput) job.probationMonths = parseFloat(monthsInput.value) || 0;
  if (regularInput) regularInput.value = formatDateSlash(getRegularDateOf(job));
  syncProbationFields();
}

// 未配置试用期（无入职日期或试用期月数<=0）时，试用期比例禁用并置空；配置后恢复可编辑
function syncProbationFields() {
  const ratioInput = document.getElementById('probationRatio');
  if (!ratioInput) return;
  const job = settings;
  const hasProbation = !!getRegularDateOf(job);
  ratioInput.disabled = !hasProbation;
  if (!hasProbation) {
    ratioInput.value = '';
  } else if (ratioInput.value === '') {
    const saved = job.probationRatio;
    ratioInput.value = (saved === undefined || saved === '') ? DEFAULTS.probationRatio : saved;
  }
  updateProbationHint();
}

// 试用期提示：直接读表单当前值，改动时实时反馈当前处于哪个阶段
function updateProbationHint() {
  const hint = document.getElementById('probationHint');
  if (!hint) return;
  const dateStr = getRegularDateOf(settings);
  const ratioInput = parseFloat(document.getElementById('probationRatio').value);
  const ratio = isNaN(ratioInput) ? 100 : Math.min(100, Math.max(0, ratioInput));
  const salary = parseFloat(document.getElementById('monthlySalary').value) || 0;
  const months = parseFloat(document.getElementById('probationMonths').value);

  if (!dateStr) {
    hint.textContent = '留空入职日期或试用期月数表示无试用期，全部按正式期月薪计算';
    return;
  }
  const regular = parseDateKey(dateStr);
  const today = new Date();
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateLabel = formatDateSlash(dateStr);
  if (!regular || day >= regular) {
    hint.textContent = `${dateLabel} 起已转正，按正式期月薪 ¥${salary.toFixed(0)}/月计算`;
  } else {
    const mLabel = (isNaN(months) || months <= 0) ? '' : `（${months} 个月）`;
    hint.textContent = `试用期至 ${dateLabel}${mLabel} 前，月薪按正式期的 ${ratio}% 计算（¥${(salary * ratio / 100).toFixed(0)}/月）`;
  }
}

// 收集设置页表单写入当前工作并持久化
function persistSettings() {
  const job = settings;
  const num = (id, fallback) => {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? fallback : v;
  };
  const companyInput = document.getElementById('companyName');
  if (companyInput) settings.companyName = companyInput.value.trim();
  job.monthlySalary = num('monthlySalary', DEFAULTS.monthlySalary);
  settings.salaryMode = settings.salaryMode || DEFAULTS.salaryMode;
  job.socialBase = num('socialBase', 0);
  job.fundBase = num('fundBase', 0);
  job.pensionRate = num('pensionRate', DEFAULTS.pensionRate);
  job.medicalRate = num('medicalRate', DEFAULTS.medicalRate);
  job.unemploymentRate = num('unemploymentRate', DEFAULTS.unemploymentRate);
  job.fundRate = num('fundRate', DEFAULTS.fundRate);
  job.medicalExtra = Math.max(0, num('medicalExtra', 0));
  SPECIAL_ITEMS.forEach(it => { job[it.key] = num(it.key, 0); });
  job.hireDate = document.getElementById('hireDate').value || '';
  job.probationMonths = num('probationMonths', 0);
  job.regularDate = document.getElementById('regularDate').value || getRegularDateOf(job);
  job.probationRatio = num('probationRatio', DEFAULTS.probationRatio);
  job.workDaysPerMonth = parseFloat(document.getElementById('workDaysPerMonth').value) || DEFAULTS.workDaysPerMonth;
  job.workDayMode = job.workDayMode || 'double';
  job.bigSmallWeekType = job.bigSmallWeekType === 'small' ? 'small' : 'big';
  settings.workedDaysDecimals = getWorkedDaysDecimals();
  job.startTime = document.getElementById('startTime').value || DEFAULTS.startTime;
  job.endTime = document.getElementById('endTime').value || DEFAULTS.endTime;
  job.lunchStart = document.getElementById('lunchStart').value || DEFAULTS.lunchStart;
  job.lunchEnd = document.getElementById('lunchEnd').value || DEFAULTS.lunchEnd;
  // 通勤：两种录入方式各自保存，合计始终同步，供计时与时薪折算使用
  job.commuteInputMode = job.commuteInputMode === 'split' ? 'split' : 'total';
  job.commuteMorning = Math.max(0, num('commuteMorning', 0));
  job.commuteEvening = Math.max(0, num('commuteEvening', 0));
  const commuteTotalInput = Math.max(0, num('commuteMinutes', 0));
  job.commuteMinutes = job.commuteInputMode === 'split'
    ? job.commuteMorning + job.commuteEvening
    : commuteTotalInput;
  job.commuteInHourly = !!job.commuteInHourly;
  settings.foreignEnabled = !!settings.foreignEnabled;
  settings.foreignCurrency = currencyOf(settings.foreignCurrency).code;
  updateShiftHint(job);
  invalidateJobCaches();
  localStorage.setItem('qianxwk_settings', JSON.stringify(settings));
}

function saveLeave() {
  localStorage.setItem('qianxwk_leave', JSON.stringify(paidLeaveSessions));
}

function fillSettingsForm() {
  const job = settings;
  const set = (id, v) => { document.getElementById(id).value = v; };
  const companyInput = document.getElementById('companyName');
  if (companyInput) companyInput.value = job.companyName || '';
  set('monthlySalary', job.monthlySalary);
  set('hireDate', formatDateSlash(job.hireDate || ''));
  set('probationMonths', job.probationMonths || '');
  set('regularDate', formatDateSlash(getRegularDateOf(job)));
  set('probationRatio', job.probationRatio);
  set('socialBase', job.socialBase > 0 ? job.socialBase : '');
  set('fundBase', job.fundBase > 0 ? job.fundBase : '');
  set('pensionRate', job.pensionRate);
  set('medicalRate', job.medicalRate);
  set('unemploymentRate', job.unemploymentRate);
  set('fundRate', job.fundRate);
  set('medicalExtra', job.medicalExtra > 0 ? job.medicalExtra : '');
  SPECIAL_ITEMS.forEach(it => set(it.key, job[it.key] > 0 ? job[it.key] : ''));
  // 放在赋值之后：口径开关会顺带刷新字段显隐、补默认到手值并重算提示
  selectSalaryMode(settings.salaryMode || DEFAULTS.salaryMode);
  document.getElementById('workDaysPerMonth').value = job.workDaysPerMonth;
  // 放在赋值之后：双休/单休时用自动算出的天数覆盖，自定义时保留已存值
  selectWorkDayMode(job.workDayMode || 'double');
  selectWorkedDaysDecimals(getWorkedDaysDecimals());
  document.getElementById('startTime').value = job.startTime;
  document.getElementById('endTime').value = job.endTime;
  document.getElementById('lunchStart').value = job.lunchStart;
  document.getElementById('lunchEnd').value = job.lunchEnd;
  updateShiftHint(job);
  document.getElementById('commuteMinutes').value = job.commuteMinutes > 0 ? job.commuteMinutes : '';
  document.getElementById('commuteMorning').value = job.commuteMorning > 0 ? job.commuteMorning : '';
  document.getElementById('commuteEvening').value = job.commuteEvening > 0 ? job.commuteEvening : '';
  selectCommuteInputMode(job.commuteInputMode || DEFAULTS.commuteInputMode);
  selectCommuteInHourly(job.commuteInHourly);
  selectOvertimeSettle(settings.overtimeSettle || DEFAULTS.overtimeSettle);
  selectOvertimeSync(settings.overtimeSync);
  selectOvertimePanelShow(overtimePanelMode());
  syncProbationFields();
  // 外币：先选中币种，再按开关同步控件的可用状态
  selectForeignCurrency(settings.foreignCurrency || DEFAULTS.foreignCurrency);
  selectForeignEnabled(settings.foreignEnabled);
}

// ============ 历史工作界面 ============
// 日期统一显示为 YYYY/MM/DD
function formatDateSlash(key) {
  const parts = String(key || '').split(/[-\/]/);
  if (parts.length !== 3) return key || '';
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

// 工作经历的时间区间文案
function jobPeriodLabel(job) {
  const hire = job.hireDate ? formatDateSlash(job.hireDate) : '未填入职';
  const end = job === settings ? '至今' : (job.endDate ? formatDateSlash(job.endDate) : '未填离职');
  return `${hire} — ${end}`;
}

// 历史工作列表里的时薪预览（按离职日期所在月份折算）
function jobHourlyPreview(job) {
  const ref = parseDateKey(job.endDate || '') || parseDateKey(job.hireDate || '') || new Date();
  return jobHourlyAt(job, ref);
}

function renderJobHistory() {
  const list = document.getElementById('jobHistoryList');
  if (!list) return;
  const ts = s => {
    const d = parseDateKey(s);
    return d ? d.getTime() : 0;
  };
  const jobs = jobHistory
    .slice()
    .sort((a, b) => ts(b.hireDate) - ts(a.hireDate) || ts(b.endDate) - ts(a.endDate));
  if (!jobs.length) {
    list.innerHTML = '<div class="job-empty">点击「添加历史工作」补录过往工作，或在跳槽时一键归档当前工作。</div>';
    return;
  }
  list.innerHTML = jobs.map(job => {
    const name = job.name || '历史工作';
    const salary = Math.round(parseFloat(job.monthlySalary) || 0).toLocaleString();
    const hourly = jobHourlyPreview(job);
    return `<div class="job-item" role="button" tabindex="0" onclick="event.stopPropagation(); editHistoryJob('${job.id}')">
      <div class="job-item-main">
        <div class="job-item-name">${escapeLedgerText(name)}</div>
        <div class="job-item-meta">${jobPeriodLabel(job)}<br>税前月薪 ¥${salary}</div>
      </div>
      <div class="job-item-pay">${hourly > 0 ? formatMoney(hourly) + '/小时' : '—'}</div>
      <button type="button" class="job-del" title="删除" onclick="event.stopPropagation(); deleteHistoryJob('${job.id}')">×</button>
    </div>`;
  }).join('');
}

// ============ 历史工作弹窗 ============
// 历史工作录入弹窗：字段与当前工作保持一致，并额外提供离职日期
function setJobModalSeg(containerId, attr, value) {
  document.querySelectorAll(`#${containerId} .seg-btn`).forEach(b => {
    b.classList.toggle('active', b.dataset[attr] === value);
  });
}

function jobModalWorkDayMode() {
  const btn = document.querySelector('#hjWorkDayMode .seg-btn.active');
  return btn ? btn.dataset.mode : 'double';
}

function jobModalCommuteMode() {
  const btn = document.querySelector('#hjCommuteMode .seg-btn.active');
  return btn ? btn.dataset.mode : 'total';
}

function jobModalCommuteOn() {
  const btn = document.querySelector('#hjCommuteInHourly .seg-btn.active');
  return btn ? btn.dataset.on === 'on' : false;
}

// 计算弹窗里「每月工作天数」：按离职日期（没有则入职日期）所在月份折算
function updateJobModalWorkDays() {
  const el = document.getElementById('hjWorkDays');
  if (!el) return;
  const hire = parseDateKey(document.getElementById('hjHireDate').value);
  const end = parseDateKey(document.getElementById('hjEndDate').value);
  const ref = end || hire || new Date();
  const mode = jobModalWorkDayMode();
  const days = countWorkdaysInMonthFor(ref.getFullYear(), ref.getMonth(), jobModalDraft || settings, mode);
  el.value = Math.max(1, days);
}

function updateJobModalRegularDate() {
  const el = document.getElementById('hjRegularDate');
  if (!el) return;
  const hire = document.getElementById('hjHireDate').value;
  const months = parseFloat(document.getElementById('hjProbationMonths').value);
  el.value = (hire && months > 0) ? formatDateSlash(addMonths(hire, months)) : '';
}

function updateJobModalCommuteUI() {
  const on = jobModalCommuteOn();
  const split = jobModalCommuteMode() === 'split';
  document.getElementById('hjCommuteTotalField').style.display = (on && !split) ? '' : 'none';
  document.getElementById('hjCommuteMorningField').style.display = (on && split) ? '' : 'none';
  document.getElementById('hjCommuteEveningField').style.display = (on && split) ? '' : 'none';
  ['hjCommuteMinutes', 'hjCommuteMorning', 'hjCommuteEvening'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.disabled = !on;
  });
  const hint = document.getElementById('hjCommuteHint');
  if (hint) {
    hint.textContent = on
      ? '通勤会计入时薪分母；往返分开填写时，去程、返程各自计时'
      : '未纳入时薪折算时，只按每日工作时间计算';
  }
}

function selectJobModalWorkDayMode(mode) {
  if (!jobModalDraft) return;
  jobModalDraft.workDayMode = mode;
  setJobModalSeg('hjWorkDayMode', 'mode', mode);
  updateJobModalWorkDays();
}

function selectJobModalCommuteInHourly(on) {
  if (!jobModalDraft) return;
  jobModalDraft.commuteInHourly = !!on;
  setJobModalSeg('hjCommuteInHourly', 'on', on ? 'on' : 'off');
  updateJobModalCommuteUI();
}

function selectJobModalCommuteMode(mode) {
  if (!jobModalDraft) return;
  const next = mode === 'split' ? 'split' : 'total';
  const prev = jobModalDraft.commuteInputMode === 'split' ? 'split' : 'total';
  jobModalDraft.commuteInputMode = next;
  setJobModalSeg('hjCommuteMode', 'mode', next);
  // 与设置页一致：切换方式时用已有数据互填，避免重复录入
  if (next !== prev) {
    if (next === 'split') {
      const total = Math.max(0, parseFloat(document.getElementById('hjCommuteMinutes').value) || 0);
      const half = Math.round(total / 2);
      document.getElementById('hjCommuteMorning').value = half || '';
      document.getElementById('hjCommuteEvening').value = Math.max(0, total - half) || '';
    } else {
      const total = Math.max(0, parseFloat(document.getElementById('hjCommuteMorning').value) || 0)
        + Math.max(0, parseFloat(document.getElementById('hjCommuteEvening').value) || 0);
      document.getElementById('hjCommuteMinutes').value = total || '';
    }
  }
  updateJobModalCommuteUI();
}

// 把历史工作草稿填入弹窗
function fillJobHistoryModal(job) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  set('hjName', job.name || '');
  set('hjHireDate', formatDateSlash(job.hireDate || ''));
  set('hjEndDate', formatDateSlash(job.endDate || ''));
  set('hjSalary', (parseFloat(job.monthlySalary) || 0) > 0 ? job.monthlySalary : '');
  set('hjProbationMonths', job.probationMonths || '');
  set('hjProbationRatio', job.probationRatio === undefined ? DEFAULTS.probationRatio : job.probationRatio);
  set('hjStartTime', job.startTime || DEFAULTS.startTime);
  set('hjEndTime', job.endTime || DEFAULTS.endTime);
  set('hjLunchStart', job.lunchStart || DEFAULTS.lunchStart);
  set('hjLunchEnd', job.lunchEnd || DEFAULTS.lunchEnd);
  set('hjCommuteMinutes', job.commuteMinutes > 0 ? job.commuteMinutes : '');
  set('hjCommuteMorning', job.commuteMorning > 0 ? job.commuteMorning : '');
  set('hjCommuteEvening', job.commuteEvening > 0 ? job.commuteEvening : '');
  set('hjSocialBase', job.socialBase > 0 ? job.socialBase : '');
  set('hjFundBase', job.fundBase > 0 ? job.fundBase : '');
  set('hjPensionRate', job.pensionRate === undefined ? DEFAULTS.pensionRate : job.pensionRate);
  set('hjMedicalRate', job.medicalRate === undefined ? DEFAULTS.medicalRate : job.medicalRate);
  set('hjUnemploymentRate', job.unemploymentRate === undefined ? DEFAULTS.unemploymentRate : job.unemploymentRate);
  set('hjFundRate', job.fundRate === undefined ? DEFAULTS.fundRate : job.fundRate);
  set('hjMedicalExtra', job.medicalExtra > 0 ? job.medicalExtra : '');
  SPECIAL_ITEMS.forEach(it => set('hj' + it.key[0].toUpperCase() + it.key.slice(1), job[it.key] > 0 ? job[it.key] : ''));
  setJobModalSeg('hjWorkDayMode', 'mode', job.workDayMode || 'double');
  setJobModalSeg('hjCommuteInHourly', 'on', job.commuteInHourly ? 'on' : 'off');
  setJobModalSeg('hjCommuteMode', 'mode', job.commuteInputMode === 'split' ? 'split' : 'total');
  updateJobModalRegularDate();
  updateJobModalWorkDays();
  updateJobModalCommuteUI();
}

// 从弹窗读取历史工作
function readJobHistoryModal() {
  const job = jobModalDraft || snapshotJob(settings);
  const num = (id, fallback) => {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? fallback : v;
  };
  job.name = document.getElementById('hjName').value.trim();
  job.hireDate = document.getElementById('hjHireDate').value || '';
  job.endDate = document.getElementById('hjEndDate').value || '';
  job.monthlySalary = Math.max(0, num('hjSalary', 0));
  job.workDayMode = jobModalWorkDayMode();
  job.workDaysPerMonth = Math.max(1, num('hjWorkDays', DEFAULTS.workDaysPerMonth));
  job.probationMonths = Math.max(0, num('hjProbationMonths', 0));
  job.probationRatio = num('hjProbationRatio', DEFAULTS.probationRatio);
  job.regularDate = getRegularDateOf(job);
  job.startTime = document.getElementById('hjStartTime').value || DEFAULTS.startTime;
  job.endTime = document.getElementById('hjEndTime').value || DEFAULTS.endTime;
  job.lunchStart = document.getElementById('hjLunchStart').value || DEFAULTS.lunchStart;
  job.lunchEnd = document.getElementById('hjLunchEnd').value || DEFAULTS.lunchEnd;
  job.commuteInHourly = jobModalCommuteOn();
  job.commuteInputMode = jobModalCommuteMode();
  job.commuteMorning = Math.max(0, num('hjCommuteMorning', 0));
  job.commuteEvening = Math.max(0, num('hjCommuteEvening', 0));
  job.commuteMinutes = job.commuteInputMode === 'split'
    ? job.commuteMorning + job.commuteEvening
    : Math.max(0, num('hjCommuteMinutes', 0));
  job.socialBase = num('hjSocialBase', 0);
  job.fundBase = num('hjFundBase', 0);
  job.pensionRate = num('hjPensionRate', DEFAULTS.pensionRate);
  job.medicalRate = num('hjMedicalRate', DEFAULTS.medicalRate);
  job.unemploymentRate = num('hjUnemploymentRate', DEFAULTS.unemploymentRate);
  job.fundRate = num('hjFundRate', DEFAULTS.fundRate);
  job.medicalExtra = Math.max(0, num('hjMedicalExtra', 0));
  SPECIAL_ITEMS.forEach(it => {
    const key = 'hj' + it.key[0].toUpperCase() + it.key.slice(1);
    job[it.key] = num(key, 0);
  });
  // 大小周历史数据沿用原来的基准周；首次配置时以今天所在周为基准
  if (job.workDayMode === 'bigsmall' && !job.bigSmallWeekStart) {
    job.bigSmallWeekStart = fmtDateKey(weekStart(new Date()));
  }
  return job;
}

function openJobHistoryModal(draft, isNew) {
  jobModalDraft = draft;
  jobModalIsNew = !!isNew;
  const overlay = document.getElementById('jobHistoryModal');
  if (!overlay) return;
  overlay.classList.add('show');
  overlay.scrollTop = 0;
  // 先让弹窗完成布局，再写入日期，避免移动端原生日期控件按隐藏时的宽度换行
  void overlay.offsetWidth;
  fillJobHistoryModal(draft);
}

function closeJobHistoryModal() {
  const overlay = document.getElementById('jobHistoryModal');
  if (overlay) overlay.classList.remove('show');
  jobModalDraft = null;
  jobModalIsNew = false;
}

function saveJobHistoryModal() {
  if (!jobModalDraft) return;
  const job = readJobHistoryModal();
  const hire = parseDateKey(job.hireDate);
  const end = parseDateKey(job.endDate);
  if (!hire) { showToast('请选择入职日期'); return; }
  if (!end) { showToast('请选择离职日期'); return; }
  if (end < hire) { showToast('离职日期不能早于入职日期'); return; }
  if (!(job.monthlySalary > 0)) { showToast('请填写税前月薪'); return; }

  const isNew = jobModalIsNew;
  if (isNew) {
    jobHistory.push(job);
  } else {
    const idx = jobHistory.findIndex(j => j.id === job.id);
    if (idx >= 0) jobHistory[idx] = job;
    else jobHistory.push(job);
  }
  saveJobHistory();
  closeJobHistoryModal();
  renderJobHistory();
  invalidateJobCaches();
  updateAll();
  showToast(isNew ? '已添加历史工作' : '历史工作已保存');
}

// 新增一段历史工作：沿用当前工作的作息 / 通勤 / 税后参数，月薪与起止日期留空待填
function addHistoryJob() {
  const draft = snapshotJob(settings);
  draft.id = newJobId();
  draft.name = '';
  draft.monthlySalary = '';
  draft.hireDate = '';
  draft.endDate = '';
  draft.regularDate = '';
  openJobHistoryModal(draft, true);
}

// 跳槽：一键把当前工作归档为历史工作，当前工作顺延到明天开始，等待填写新工作
function archiveCurrentJob() {
  const today = fmtDateKey(new Date());
  if (jobModalDraft) {
    showToast('先完成历史工作录入');
    return;
  }
  if (!settings.hireDate) {
    showToast('先在设置里填写当前工作的入职日期');
    return;
  }
  const hireD = parseDateKey(settings.hireDate);
  const todayD = parseDateKey(today);
  if (hireD && todayD && hireD > todayD) {
    showToast('当前工作还没开始，无需归档');
    return;
  }
  if (!confirm('把当前工作归档到历史？归档后当前工作会从明天开始，作为一段新的工作，记得重新填写新工作的月薪与入职时间。')) return;

  const job = snapshotJob(settings);
  job.id = newJobId();
  job.name = settings.companyName || '';
  job.endDate = today;
  jobHistory.push(job);
  saveJobHistory();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  settings.hireDate = fmtDateKey(tomorrow);
  settings.regularDate = getRegularDateOf(settings);
  settings.companyName = '';
  try { localStorage.setItem('qianxwk_settings', JSON.stringify(settings)); } catch (e) { /* 写入失败不影响使用 */ }

  invalidateJobCaches();
  renderJobHistory();
  fillSettingsForm();
  updateAll();
  showToast('已归档，当前工作已从明天开始，请填写新工作信息');
}

function editHistoryJob(id) {
  const job = jobHistory.find(j => j.id === id);
  if (!job) return;
  // 编辑副本，取消时不影响原记录
  openJobHistoryModal({ ...job, customWorkDates: [...(job.customWorkDates || [])] }, false);
}

function deleteHistoryJob(id) {
  const job = jobHistory.find(j => j.id === id);
  if (!job) return;
  if (!confirm(`删除历史工作「${job.name || jobPeriodLabel(job)}」？删除后相关统计会重新计算。`)) return;
  jobHistory = jobHistory.filter(j => j.id !== id);
  saveJobHistory();
  if (jobModalDraft && jobModalDraft.id === id) closeJobHistoryModal();
  renderJobHistory();
  invalidateJobCaches();
  updateAll();
  showToast('已删除历史工作');
}

// ============ 计算 ============
// 个税税率表（综合所得年度税率；累计预扣法下，全年税额与按年计算一致）
const IIT_BRACKETS = [
  { limit: 36000,   rate: 0.03, quick: 0 },
  { limit: 144000,  rate: 0.10, quick: 2520 },
  { limit: 300000,  rate: 0.20, quick: 16920 },
  { limit: 420000,  rate: 0.25, quick: 31920 },
  { limit: 660000,  rate: 0.30, quick: 52920 },
  { limit: 960000,  rate: 0.35, quick: 85920 },
  { limit: Infinity, rate: 0.45, quick: 181920 }
];
const IIT_THRESHOLD_MONTHLY = 5000; // 个税起征点（元/月）
const STANDARD_MONTH_DAYS = 21.75;  // 首月工资折算用的月计薪天数

function calcIIT(annualTaxable) {
  if (!(annualTaxable > 0)) return 0;
  const b = IIT_BRACKETS.find(x => annualTaxable <= x.limit);
  return annualTaxable * b.rate - b.quick;
}

// 单月五险一金个人部分：缴费基数留空（<=0）时按整月工资计算（首月折算不影响缴费基数）
function calcMonthlyInsurance(gross, o, baseGross) {
  const base = baseGross === undefined ? gross : baseGross;
  const socialBase = o.socialBase > 0 ? o.socialBase : base;
  const fundBase = o.fundBase > 0 ? o.fundBase : base;
  // 大额医疗互助是固定金额，不与缴费基数挂钩（如北京按医疗 2% + 3 元）
  const social = socialBase * (o.pensionRate + o.medicalRate + o.unemploymentRate) / 100
    + Math.max(0, o.medicalExtra || 0);
  const fund = fundBase * o.fundRate / 100;
  return { social, fund, insurance: social + fund };
}

// 「yyyy-MM-dd」或「yyyy/MM/dd」-> 本地日期，非法返回 null
function parseDateKey(str) {
  const m = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(str || '');
  if (!m) return null;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return isNaN(d.getTime()) ? null : d;
}

// 以入职时间为起点生成当年的逐月明细：入职前不计收入，转正前按试用期比例计薪，
// 入职当月按 21.75 天折算实际出勤工资，个税按累计预扣法逐月计算
// （累计应纳所得额 × 年税率 - 速算扣除数，再减去已预扣部分）
function buildMonthlySchedule(o, job) {
  const cfg = job || settings;
  const now = new Date();
  const year = now.getFullYear();
  const grossFull = Math.max(0, o.gross || 0);
  const special = o.special || 0;
  const ratioPct = parseFloat(o.probationRatio);
  const ratio = (isNaN(ratioPct) || ratioPct <= 0 ? 100 : Math.min(100, ratioPct)) / 100;

  const hire = parseDateKey(cfg.hireDate || '');
  // 入职日期在当前年份则从入职当月起算；跨年或未填则按整年处理
  const startMonth = (hire && hire.getFullYear() === year) ? hire.getMonth() : 0;
  const regular = parseDateKey(getRegularDateOf(cfg));

  const rows = [];
  let cumTaxable = 0;
  let prevTax = 0;
  for (let m = startMonth; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    const monthEnd = new Date(year, m + 1, 0);
    const probation = !!regular && monthStart < regular;
    const monthPay = probation ? grossFull * ratio : grossFull;
    let gross;
    if (regular && regular > monthStart && regular <= monthEnd) {
      // 转正当月：转正前按试用期比例、转正后按正式月薪，按实际工作日加权折算
      let probationDays = 0;
      let regularDays = 0;
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        if (!isWorkdayByConfig(d, cfg)) continue;
        if (hire && d < hire) continue;
        if (d < regular) probationDays++;
        else regularDays++;
      }
      const weighted = (probationDays * ratio + regularDays) / STANDARD_MONTH_DAYS;
      gross = grossFull * Math.min(1, weighted);
    } else if (hire && hire.getFullYear() === year && hire.getMonth() === m) {
      // 入职当月按 21.75 天折算：只计入职日到月底的工作日；五险一金仍按整月工资作基数
      let attended = 0;
      for (let d = new Date(hire); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        if (isWorkdayByConfig(d, cfg)) attended++;
      }
      gross = monthPay * Math.min(1, attended / STANDARD_MONTH_DAYS);
    } else {
      gross = monthPay;
    }
    const ins = calcMonthlyInsurance(gross, o, monthPay);
    const taxable = gross - ins.insurance - special - IIT_THRESHOLD_MONTHLY;
    cumTaxable += taxable;
    const cumTax = calcIIT(cumTaxable);
    const tax = Math.max(0, cumTax - prevTax);
    prevTax = cumTax;
    rows.push({
      month: m, probation, gross,
      social: ins.social, fund: ins.fund, insurance: ins.insurance,
      tax, cumTax, net: gross - ins.insurance - tax
    });
  }
  return rows;
}

// 汇总试用期 / 转正后两个阶段的月均到手，并返回全年个税
function calcNetProfile(o, job) {
  const rows = buildMonthlySchedule(o, job);
  const avg = (arr, key) => arr.reduce((s, x) => s + x[key], 0) / arr.length;
  const summarize = arr => arr.length ? {
    months: arr.length,
    net: avg(arr, 'net'),
    social: avg(arr, 'social'),
    fund: avg(arr, 'fund'),
    insurance: avg(arr, 'insurance'),
    tax: avg(arr, 'tax')
  } : null;
  return {
    probation: summarize(rows.filter(r => r.probation)),
    regular: summarize(rows.filter(r => !r.probation)),
    annualTax: rows.reduce((s, r) => s + r.tax, 0)
  };
}

// 指定日期是否处于某段工作的试用期（未配置试用期时视为已转正）
function isInProbationAt(date, job) {
  const regular = parseDateKey(getRegularDateOf(job));
  if (!regular) return false;
  const d = date || new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()) < regular;
}

function isInProbationNow() {
  return isInProbationAt(new Date(), settings);
}

// 收集测算参数，read(id) 决定数据来自设置页表单还是已保存的 settings
function readTaxParams(read) {
  return {
    gross: read('monthlySalary'),
    socialBase: read('socialBase'),
    fundBase: read('fundBase'),
    pensionRate: read('pensionRate'),
    medicalRate: read('medicalRate'),
    unemploymentRate: read('unemploymentRate'),
    fundRate: read('fundRate'),
    medicalExtra: read('medicalExtra'),
    probationRatio: read('probationRatio'),
    special: SPECIAL_ITEMS.reduce((sum, it) => sum + read(it.key), 0)
  };
}

function taxParamsFromJob(job) {
  const cfg = job || settings;
  return readTaxParams(key => {
    const v = parseFloat(cfg[key]);
    return isNaN(v) ? 0 : v;
  });
}

function taxParamsFromSettings() {
  return taxParamsFromJob(settings);
}

// 转正日期之前为试用期：返回当天的薪资系数（试用期比例/100），已转正或未设置试用期为 1
function salaryFactorFor(date, job) {
  const cfg = job || settings;
  const regularDate = getRegularDateOf(cfg);
  if (!regularDate) return 1;
  const regular = parseDateKey(regularDate);
  if (!regular) return 1;
  const d = date || new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (day >= regular) return 1;
  const ratio = parseFloat(cfg.probationRatio);
  return (isNaN(ratio) ? 100 : Math.min(100, Math.max(0, ratio))) / 100;
}

// 统计口径：税前模式只算税前月薪；税后与对比模式按入职起的逐月明细取当前阶段（试用期/转正后）月均到手
function getMonthlyNet(job) {
  const cfg = job || settings;
  const mode = settings.salaryMode || DEFAULTS.salaryMode;
  if (mode === 'gross') return cfg.monthlySalary * salaryFactorFor(new Date(), cfg);
  const profile = calcNetProfile(taxParamsFromJob(cfg), cfg);
  const phase = isInProbationAt(new Date(), cfg)
    ? (profile.probation || profile.regular)
    : (profile.regular || profile.probation);
  return phase ? phase.net : cfg.monthlySalary * salaryFactorFor(new Date(), cfg);
}

// 税前月薪（不扣五险一金与个税），用于税后/对比口径下的对照展示（含试用期折算）
function getMonthlyGross(job) {
  const cfg = job || settings;
  return cfg.monthlySalary * salaryFactorFor(new Date(), cfg);
}

// 「HH:MM」-> 当天分钟数
function timeToMinutes(t) {
  const parts = String(t || '').split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

// 班次时间轴：下班时间早于上班时间时视为跨天夜班，
// 下班与午休统一换算成「距上班当天 0 点」的分钟数（可能超过 1440）
function getShiftTimes(job) {
  const cfg = job || settings;
  const start = timeToMinutes(cfg.startTime);
  let end = timeToMinutes(cfg.endTime);
  const crossDay = end < start;
  if (crossDay) end += 1440;

  let lunchStart = timeToMinutes(cfg.lunchStart);
  let lunchEnd = timeToMinutes(cfg.lunchEnd);
  if (lunchEnd < lunchStart) lunchEnd += 1440; // 午休本身跨天（如 23:00-00:00）
  // 夜班午休常落在凌晨（如 02:00-03:00），平移对齐到上班之后的那一次
  while (lunchEnd <= start) {
    lunchStart += 1440;
    lunchEnd += 1440;
  }

  // 只扣完全/部分落在班次内的午休，避免沿用白班午休时间时误扣
  const lunchMinutes = Math.max(0, Math.min(lunchEnd, end) - Math.max(lunchStart, start));
  const duration = Math.max(0, end - start);
  return {
    start,
    end,
    crossDay,
    duration,
    lunchStart,
    lunchEnd,
    lunchMinutes,
    workMinutes: Math.max(0, duration - lunchMinutes)
  };
}

// 计时口径下的「当前班次归属日」：跨天夜班的凌晨时段仍算前一天
function getShiftAnchorDate(now) {
  const d = now || new Date();
  const shift = getShiftTimes();
  const anchor = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowMinutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  // 下班时刻（含返程通勤）之前的凌晨，属于昨天开始的那一班
  const paidEnd = shift.end + getCommuteSplit().after;
  if (shift.crossDay && nowMinutes < paidEnd % 1440) anchor.setDate(anchor.getDate() - 1);
  return anchor;
}

// 每日通勤分钟数：仅在「纳入时薪折算」开启时计入计时
function getCommuteMinutes(job) {
  const cfg = job || settings;
  if (!cfg.commuteInHourly) return 0;
  if ((cfg.commuteInputMode || DEFAULTS.commuteInputMode) === 'split') {
    return Math.max(0, parseFloat(cfg.commuteMorning) || 0)
      + Math.max(0, parseFloat(cfg.commuteEvening) || 0);
  }
  return Math.max(0, parseFloat(cfg.commuteMinutes) || 0);
}

// 通勤拆分：split 模式按往返分别取，total 模式往返各半
function getCommuteSplit(job) {
  const cfg = job || settings;
  const total = getCommuteMinutes(cfg);
  if ((cfg.commuteInputMode || DEFAULTS.commuteInputMode) === 'split') {
    const before = Math.max(0, parseFloat(cfg.commuteMorning) || 0);
    const after = Math.max(0, parseFloat(cfg.commuteEvening) || 0);
    return { before, after, total: before + after };
  }
  return { before: total / 2, after: total / 2, total };
}

// 计入通勤后的每日计时总长（小时），按天折算收益时使用
function getPaidDailyHours(job) {
  const cfg = job || settings;
  return (getShiftTimes(cfg).workMinutes + getCommuteMinutes(cfg)) / 60;
}

// 月薪 -> 时薪，按每日实际工作时长与月工作天数折算（开启后通勤时长一并计入分母）
function calcHourlyRate(salary, job) {
  const cfg = job || settings;
  const workDays = cfg.workDaysPerMonth;
  const dailyHours = getPaidDailyHours(cfg);
  const monthlyHours = dailyHours * workDays;
  return monthlyHours > 0 ? salary / monthlyHours : 0;
}

// 当前统计口径下的时薪（税后口径即到手时薪）
function getHourlyRate() {
  return calcHourlyRate(getMonthlyNet());
}

// 税前时薪，用于税后口径下的对照展示
function getGrossHourlyRate() {
  return calcHourlyRate(getMonthlyGross());
}

function getMinuteRate() {
  return getHourlyRate() / 60;
}

// 每个工作日的实际工作时长（小时，已扣除午休；跨天夜班按完整班次计）
function getDailyHours(job) {
  return getShiftTimes(job).workMinutes / 60;
}

function getCurrentWorkState() {
  const now = new Date();
  const shift = getShiftTimes();
  // 跨天夜班的凌晨时段仍属于前一天开始的班次
  const anchor = getShiftAnchorDate(now);
  const prevDayShift = fmtDateKey(anchor) !== fmtDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  // 当前时刻距本班次上班的分钟数；负数表示还没上班
  const pos = (prevDayShift ? nowMinutes + 1440 : nowMinutes) - shift.start;

  // 纳入时薪折算的通勤时间：total 模式往返各半，split 模式按往返分别取
  const commuteSplit = getCommuteSplit();
  const commuteBefore = commuteSplit.before;
  const commuteAfter = commuteSplit.after;
  const commuteTotal = commuteSplit.total;
  // 上下班计时只按班次工作时间，通勤单独计时
  const workMinutes = shift.workMinutes;
  const totalPaidMinutes = workMinutes + commuteTotal;

  const base = {
    workedMinutes: 0,
    workWorkedMinutes: 0,
    remainingMinutes: 0,
    totalWorkMinutes: 0,
    totalPaidMinutes,
    isWorking: false,
    isLunch: false,
    isCommuting: false,
    isRest: true,
    progress: 0,
    earnedToday: 0,
    remainingValue: 0,
    crossDay: shift.crossDay,
    shiftDate: anchor,
    commuteBefore,
    commuteAfter,
    commuteTotal,
    commutePhase: 'none',
    commuteLegElapsed: 0
  };

  // 非工作日（周末/法定节假日）不计时，避免休息日仍在累计工时与收益
  // 当前工作尚未入职（如刚归档后默认明天开始）时同样不计时
  if (!jobCoversDate(settings, anchor) || !isWorkday(anchor)) return base;

  // 班次内的午休区间（相对上班时间）；午休部分落在班次外时只按重叠部分处理
  const lunchS = Math.max(shift.lunchStart, shift.start) - shift.start;
  const lunchE = Math.min(shift.lunchEnd, shift.end) - shift.start;
  const hasLunch = shift.lunchMinutes > 0 && lunchE > lunchS;

  let workWorked = 0;
  let isWorking = false;
  let isLunch = false;

  if (pos <= 0) {
    // 还没上班
    workWorked = 0;
  } else if (pos >= shift.duration) {
    // 已下班
    workWorked = workMinutes;
  } else if (hasLunch && pos < lunchS) {
    isWorking = true;
    workWorked = pos;
  } else if (hasLunch && pos < lunchE) {
    isLunch = true;
    workWorked = lunchS;
  } else {
    isWorking = true;
    workWorked = pos - shift.lunchMinutes;
  }
  workWorked = Math.max(0, Math.min(workMinutes, workWorked));

  // 通勤计时：去程在上班前，返程在下班后，各自独立累计
  let isCommuting = false;
  let commutePhase = 'none';
  let commuteElapsed = 0;
  let commuteLegElapsed = 0;
  if (commuteTotal > 0) {
    if (commuteBefore > 0 && pos >= -commuteBefore && pos < 0) {
      isCommuting = true;
      commutePhase = 'morning';
      commuteLegElapsed = pos + commuteBefore;
      commuteElapsed = commuteLegElapsed;
    } else if (commuteAfter > 0 && pos >= shift.duration && pos < shift.duration + commuteAfter) {
      isCommuting = true;
      commutePhase = 'evening';
      commuteLegElapsed = pos - shift.duration;
      commuteElapsed = commuteBefore + commuteLegElapsed;
    } else if (pos < 0) {
      commutePhase = 'before';
    } else if (pos < shift.duration) {
      commutePhase = 'working';
      commuteElapsed = commuteBefore;
    } else {
      commutePhase = 'done';
      commuteElapsed = commuteTotal;
    }
  }

  // 收益口径仍包含通勤：工作时长 + 已完成的通勤时长
  const paidWorked = Math.max(0, Math.min(totalPaidMinutes, workWorked + commuteElapsed));
  const remainingMinutes = Math.max(0, workMinutes - workWorked);

  return {
    workedMinutes: paidWorked,
    workWorkedMinutes: workWorked,
    remainingMinutes,
    totalWorkMinutes: workMinutes,
    totalPaidMinutes,
    isWorking,
    isLunch,
    isCommuting,
    isRest: false,
    progress: workMinutes > 0 ? (workWorked / workMinutes) * 100 : 0,
    earnedToday: paidWorked * getMinuteRate(),
    remainingValue: Math.max(0, totalPaidMinutes - paidWorked) * getMinuteRate(),
    crossDay: shift.crossDay,
    shiftDate: anchor,
    commuteBefore,
    commuteAfter,
    commuteTotal,
    commutePhase,
    commuteLegElapsed
  };
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// 分钟数 -> 「HH:MM」，支持跨天回绕
function minutesToClock(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function formatMoney(val) {
  return '¥' + val.toFixed(2);
}

// ============ 外币换算 ============
// 币种表：code 用于汇率接口，name 展示，symbol 作为金额前缀
const CURRENCIES = [
  { code: 'USD', name: '美元',     symbol: '$' },
  { code: 'HKD', name: '港币',     symbol: 'HK$' },
  { code: 'EUR', name: '欧元',     symbol: '€' },
  { code: 'GBP', name: '英镑',     symbol: '£' },
  { code: 'JPY', name: '日元',     symbol: '¥' },
  { code: 'KRW', name: '韩元',     symbol: '₩' },
  { code: 'SGD', name: '新加坡元', symbol: 'S$' },
  { code: 'AUD', name: '澳元',     symbol: 'A$' },
  { code: 'CAD', name: '加元',     symbol: 'C$' },
  { code: 'TWD', name: '新台币',   symbol: 'NT$' },
  { code: 'CHF', name: '瑞士法郎', symbol: 'CHF' },
  { code: 'THB', name: '泰铢',     symbol: '฿' }
];

// 内置兜底汇率：1 元人民币可兑换的外币数量；联网获取失败时使用
const FALLBACK_RATES = {
  USD: 0.14, HKD: 1.09, EUR: 0.13, GBP: 0.11, JPY: 21.5, KRW: 195,
  SGD: 0.19, AUD: 0.21, CAD: 0.20, TWD: 4.5, CHF: 0.12, THB: 4.8
};

// 汇率接口：返回「1 CNY = x 外币」的汇率表
const RATE_API = 'https://open.er-api.com/v6/latest/CNY';
const RATE_CACHE_KEY = 'qianxwk_fx_rates';

let fxRates = { ...FALLBACK_RATES }; // 运行时汇率表
let fxRateDate = '';                 // 汇率日期；为空表示用的是内置兜底汇率
let fxDay = fmtDateKey(new Date());  // 上次检查汇率的自然日，用于跨天自动刷新
let fxMonthKey = currentMonthKey();  // 上次检查自定义工作日弹窗的月份，用于每月自动弹窗

function currencyOf(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

function rateOf(code) {
  const r = fxRates[code];
  return typeof r === 'number' && r > 0 ? r : (FALLBACK_RATES[code] || 1);
}

// 读取本地缓存汇率：只要存在就载入「最近一次成功的汇率」，
// 联网失败时继续沿用；返回是否为「今天」写的新鲜缓存（当天已拉取过则无需再联网）
function loadRateCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(RATE_CACHE_KEY));
    if (!raw || !raw.rates) return false;
    fxRates = { ...FALLBACK_RATES, ...raw.rates };
    fxRateDate = raw.date || '';
    return raw.day === fmtDateKey(new Date());
  } catch (e) { return false; }
}

// 联网刷新汇率：成功后写入缓存并刷新界面；失败则保留最近一次成功的汇率（无缓存时用内置汇率）
async function refreshRates() {
  if (loadRateCache()) { updateForeignHint(); updateTimer(); return; }
  try {
    const res = await fetch(RATE_API);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const rates = json && json.rates;
    if (!rates) throw new Error('数据格式异常');
    const merged = { ...FALLBACK_RATES };
    CURRENCIES.forEach(c => {
      const v = rates[c.code];
      if (typeof v === 'number' && v > 0) merged[c.code] = v;
    });
    fxRates = merged;
    // 接口返回的汇率更新时间取不到时记为今天
    const updated = json.time_last_update_utc;
    fxRateDate = updated ? new Date(updated).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    try {
      // 记录抓取当天，用于判断缓存是否跨天过期
      localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ day: fmtDateKey(new Date()), date: fxRateDate, rates: merged }));
    } catch (e) { /* 缓存写入失败不影响使用 */ }
  } catch (e) { /* 联网失败：沿用 loadRateCache 载入的上次成功汇率 */ }
  updateForeignHint();
  updateTimer();
}

// 把人民币金额换算为所选外币的展示文本；未开启外币时返回空串
function fxText(cny) {
  if (!settings.foreignEnabled) return '';
  const cur = currencyOf(settings.foreignCurrency);
  const val = cny * rateOf(cur.code);
  // 日元、韩元金额较大，不显示小数
  const digits = (cur.code === 'JPY' || cur.code === 'KRW') ? 0 : 2;
  return `≈ ${cur.symbol}${val.toFixed(digits)}`;
}

// 外币区块的币种名称标签（每张卡片一处，置于外币金额上方）；未开启外币时隐藏
function setFxName(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const on = !!settings.foreignEnabled;
  el.textContent = on ? currencyOf(settings.foreignCurrency).name : '';
  el.style.display = on ? '' : 'none';
}

// 写入卡片内的外币附加行；unit 为金额单位（如 '/小时'）；无内容时不占位
function setFxLine(id, cny, unit) {
  const el = document.getElementById(id);
  if (!el) return;
  const t = fxText(cny);
  el.textContent = t ? t + (unit || '') : '';
  el.style.display = t ? '' : 'none';
}

// 设置页：外币开关
function selectForeignEnabled(on) {
  settings.foreignEnabled = !!on;
  document.querySelectorAll('#foreignEnabled .seg-btn').forEach(b => {
    b.classList.toggle('active', (b.dataset.on === 'on') === !!on);
  });
  const sel = document.getElementById('foreignCurrencySelect');
  if (sel) sel.disabled = !on;
  updateForeignHint();
  updateTimer();
}

// 设置页：选择外币币种
function selectForeignCurrency(code) {
  settings.foreignCurrency = currencyOf(code).code;
  const sel = document.getElementById('foreignCurrencySelect');
  if (sel && sel.value !== settings.foreignCurrency) sel.value = settings.foreignCurrency;
  updateForeignHint();
  updateTimer();
}

// 从币种表填充下拉选项（只需在首次进入时调用）
function populateCurrencySelect() {
  const sel = document.getElementById('foreignCurrencySelect');
  if (!sel) return;
  sel.innerHTML = CURRENCIES.map(c => `<option value="${c.code}">${c.name} ${c.symbol}</option>`).join('');
}

// 设置页：外币选项提示，含当前汇率与来源
function updateForeignHint() {
  const hint = document.getElementById('foreignHint');
  if (!hint) return;
  if (!settings.foreignEnabled) {
    hint.textContent = '开启后，计时页会在人民币金额下方附加所选外币的换算';
    return;
  }
  const cur = currencyOf(settings.foreignCurrency);
  const src = fxRateDate ? `汇率日期 ${fxRateDate}` : '内置汇率，联网后将自动更新';
  hint.textContent = `当前 1 元人民币 ≈ ${Number(rateOf(cur.code).toPrecision(4))} ${cur.name}（${cur.symbol}）· ${src}`;
}

// 设置页：通勤计时方式（合计自动÷2 / 往返分开填），切换时用已有数据互填
function selectCommuteInputMode(mode) {
  const job = settings;
  const next = mode === 'split' ? 'split' : 'total';
  const prev = job.commuteInputMode || DEFAULTS.commuteInputMode;
  job.commuteInputMode = next;
  document.querySelectorAll('#commuteInputMode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === next);
  });
  const split = next === 'split';
  document.getElementById('commuteTotalField').style.display = split ? 'none' : '';
  document.getElementById('commuteMorningField').style.display = split ? '' : 'none';
  document.getElementById('commuteEveningField').style.display = split ? '' : 'none';

  // 仅在用户主动切换时互填，避免进入设置页时覆盖已保存的值
  if (split !== (prev === 'split')) {
    if (split) {
      // 切到往返分开：用当前合计按各半预填，可再单独调整
      const total = Math.max(0, parseFloat(job.commuteMinutes) || 0);
      const half = Math.round(total / 2);
      job.commuteMorning = half;
      job.commuteEvening = Math.max(0, total - half);
      document.getElementById('commuteMorning').value = job.commuteMorning || '';
      document.getElementById('commuteEvening').value = job.commuteEvening || '';
    } else {
      // 切到一天合计：用往返之和预填
      const total = Math.max(0, parseFloat(job.commuteMorning) || 0)
        + Math.max(0, parseFloat(job.commuteEvening) || 0);
      job.commuteMinutes = total;
      document.getElementById('commuteMinutes').value = total > 0 ? total : '';
    }
  }
  updateCommuteHint();
}

// 设置页：通勤时间是否纳入时薪折算（关闭时通勤时长禁用并清零）
function selectCommuteInHourly(on) {
  const job = settings;
  job.commuteInHourly = !!on;
  document.querySelectorAll('#commuteInHourly .seg-btn').forEach(b => {
    b.classList.toggle('active', (b.dataset.on === 'on') === !!on);
  });
  // 关闭通勤时，计时方式不可切换
  const modeControl = document.getElementById('commuteInputMode');
  if (modeControl) modeControl.classList.toggle('disabled', !on);
  ['commuteMinutes', 'commuteMorning', 'commuteEvening'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.disabled = !on;
    if (!on) input.value = '';
  });
  if (!on) {
    job.commuteMinutes = 0;
    job.commuteMorning = 0;
    job.commuteEvening = 0;
  }
  updateCommuteHint();
}

// 分钟 -> 「X 小时 Y 分钟」文本
function fmtDurationMinutes(mins) {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} 分钟`;
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

// 计时卡片顶部：时薪已含通勤时间的标识（仅开启且通勤 > 0 时展示）
function updateCommuteBadge() {
  const el = document.getElementById('commuteBadge');
  if (!el) return;
  const commute = getCommuteMinutes();
  const active = commute > 0;
  el.textContent = active ? `🚌 含通勤 ${fmtDurationMinutes(commute)}` : '';
  el.style.display = active ? '' : 'none';
}

// 设置页：班次提示，下班早于上班时按跨天夜班解释
function updateShiftHint(job) {
  const cfg = job || settings;
  const el = document.getElementById('shiftTimeHint');
  const startLabel = document.getElementById('lunchStartLabel');
  const endLabel = document.getElementById('lunchEndLabel');
  const shift = getShiftTimes(cfg);
  // 跨天夜班里这段休息常落在凌晨，名称改为「休息」更贴切
  if (startLabel) startLabel.textContent = shift.crossDay ? '休息开始' : '午休开始';
  if (endLabel) endLabel.textContent = shift.crossDay ? '休息结束' : '午休结束';
  if (!el) return;
  if (!shift.crossDay) { el.textContent = ''; return; }
  el.textContent = `下班早于上班，按跨天夜班计算：${cfg.startTime} 上班，次日 ${cfg.endTime} 下班，每天工作 ${fmtDurationMinutes(shift.workMinutes)}。`;
}

// 设置页：通勤提示，按「关闭 / 合计 / 往返」合并成一条
function updateCommuteHint() {
  const hint = document.getElementById('commuteHint');
  if (!hint) return;
  const job = settings;
  const workMinutes = getShiftTimes(job).workMinutes;
  const split = (job.commuteInputMode || DEFAULTS.commuteInputMode) === 'split';
  const readVal = id => {
    const input = document.getElementById(id);
    return Math.max(0, parseFloat(input && input.value) || 0);
  };

  if (!job.commuteInHourly) {
    hint.textContent = `未纳入计时：只按每日工作 ${fmtDurationMinutes(workMinutes)} 折算；开启后通勤会并入时薪与收益`;
    return;
  }

  if (split) {
    const morning = readVal('commuteMorning');
    const evening = readVal('commuteEvening');
    const total = morning + evening;
    hint.textContent = total > 0
      ? `往返：分别填去程、返程分钟；当前每天 ${fmtDurationMinutes(workMinutes)} 工作 + ${fmtDurationMinutes(morning)} 去程 + ${fmtDurationMinutes(evening)} 返程，共 ${fmtDurationMinutes(workMinutes + total)} 折算时薪`
      : '往返：分别填去程、返程分钟；当前通勤为 0，暂不影响时薪与计时';
    return;
  }

  const total = readVal('commuteMinutes');
  hint.textContent = total > 0
    ? `合计：填一天往返总分钟，自动往返各半；当前每天 ${fmtDurationMinutes(workMinutes)} 工作 + ${fmtDurationMinutes(total)} 通勤，共 ${fmtDurationMinutes(workMinutes + total)} 折算时薪`
    : '合计：填一天往返总分钟，自动往返各半；当前通勤为 0，暂不影响时薪与计时';
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

// 法定节假日数据：优先联网获取，失败时回退到下面的内置数据
//   放假日期（含调休放假的周末）
//   调休补班日期（原本是周末但需上班）
//   联网成功后写入 localStorage 缓存（30 天有效）并覆盖内置数据；
//   内置数据仅为兜底（按国务院办公厅通知录入，每年需更新一次），
//   两者都拿不到时回退到「按周几判断」，不会报错。
const HOLIDAY_API = 'https://timor.tech/api/holiday/year/';
const HOLIDAY_CACHE_PREFIX = 'qianxwk_holiday_';
const HOLIDAY_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 缓存 30 天

const HOLIDAY_DATA = {
  2026: {
    holidays: [
      '2026-01-01','2026-01-02','2026-01-03',                  // 元旦
      '2026-02-15','2026-02-16','2026-02-17','2026-02-18',     // 春节(9天)
      '2026-02-19','2026-02-20','2026-02-21','2026-02-22','2026-02-23',
      '2026-04-04','2026-04-05','2026-04-06',                  // 清明
      '2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05', // 劳动节
      '2026-06-19','2026-06-20','2026-06-21',                  // 端午
      '2026-09-25','2026-09-26','2026-09-27',                  // 中秋
      '2026-10-01','2026-10-02','2026-10-03','2026-10-04',     // 国庆(7天)
      '2026-10-05','2026-10-06','2026-10-07'
    ],
    workdays: [
      '2026-01-04', // 元旦调休
      '2026-02-14','2026-02-28', // 春节调休
      '2026-05-09', // 劳动节调休
      '2026-09-20','2026-10-10'  // 国庆调休
    ]
  }
};

// 运行时生效的节假日集合：内置数据打底，缓存/联网数据覆盖
const holidaySets = {};

function _holidaySets(year) {
  if (!holidaySets[year]) {
    const data = HOLIDAY_DATA[year];
    if (!data) return null;
    holidaySets[year] = {
      holidays: new Set(data.holidays),
      workdays: new Set(data.workdays)
    };
  }
  return holidaySets[year];
}

function applyHolidayData(year, holidays, workdays) {
  holidaySets[year] = {
    holidays: new Set(holidays),
    workdays: new Set(workdays)
  };
}

function readHolidayCache(year) {
  try {
    const raw = JSON.parse(localStorage.getItem(HOLIDAY_CACHE_PREFIX + year));
    if (!raw || !raw.ts || Date.now() - raw.ts > HOLIDAY_CACHE_TTL) return false;
    if (!raw.holidays || !raw.holidays.length) return false;
    applyHolidayData(year, raw.holidays, raw.workdays || []);
    return true;
  } catch (e) {
    return false;
  }
}

// 联网获取某年节假日，成功返回 true
async function fetchHolidayData(year) {
  try {
    const res = await fetch(HOLIDAY_API + year);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (json.code !== 0 || !json.holiday) throw new Error('数据格式异常');

    const holidays = [];
    const workdays = [];
    Object.keys(json.holiday).forEach(k => {
      const d = json.holiday[k];
      if (!d || !d.date) return;
      (d.holiday ? holidays : workdays).push(d.date);
    });
    if (!holidays.length) throw new Error('无节假日数据');

    applyHolidayData(year, holidays, workdays);
    try {
      localStorage.setItem(HOLIDAY_CACHE_PREFIX + year, JSON.stringify({
        ts: Date.now(), holidays, workdays
      }));
    } catch (e) { /* 缓存写入失败不影响使用 */ }
    return true;
  } catch (e) {
    return false; // 联网失败沿用内置数据
  }
}

// 本地已有当年有效缓存时直接用，不再联网；无缓存或缓存过期才联网获取并写入缓存
const holidayFetched = {};
async function refreshHolidays() {
  const year = new Date().getFullYear();
  if (holidayFetched[year]) return;
  holidayFetched[year] = true;

  if (readHolidayCache(year)) { syncAutoWorkDays(); updateAll(); return; }
  if (await fetchHolidayData(year)) { syncAutoWorkDays(); updateAll(); }
}

function fmtDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayType(date) {
  // 日期类型：holiday 法定放假 / makeup 调休补班 / normal 普通工作日
  const sets = _holidaySets(date.getFullYear());
  if (sets) {
    const key = fmtDateKey(date);
    if (sets.workdays.has(key)) return 'makeup';
    if (sets.holidays.has(key)) return 'holiday';
  }
  return 'normal';
}

function isWorkdayByConfig(date, cfg, mode) {
  const job = cfg || settings;
  const m = mode || job.workDayMode;
  // 自定义：当月日历里的上班日期为准（含手动把节假日改成上班）
  if (m === 'custom' && hasCustomWorkDatesFor(job, monthKeyOf(date))) {
    return job.customWorkDates.includes(fmtDateKey(date));
  }
  const t = dayType(date);
  if (t === 'makeup') return true;   // 调休补班日：按工作日计
  if (t === 'holiday') return false;  // 法定放假日：不计工作日
  const dow = date.getDay();
  // 单休：仅周日休息（周一至周六上班）
  if (m === 'single') return dow !== 0;
  // 大小周：双休周按周一至周五，单休周按周一至周六
  if (m === 'bigsmall') {
    return bigSmallWeekTypeOf(date, job) === 'big' ? (dow !== 0 && dow !== 6) : dow !== 0;
  }
  // 双休 / 自定义未选择时：按周一至周五计
  return dow !== 0 && dow !== 6;
}

function isWorkday(date, mode) {
  return isWorkdayByConfig(date, settings, mode);
}

// 某年某月的实际工作日数（已含法定节假日与调休补班）；可指定工作配置
function countWorkdaysInMonthFor(year, month, cfg, mode) {
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let i = 1; i <= days; i++) {
    if (isWorkdayByConfig(new Date(year, month, i), cfg, mode)) count++;
  }
  return count;
}

function countWorkdaysInMonth(year, month, mode) {
  return countWorkdaysInMonthFor(year, month, settings, mode);
}

// 双休/单休/大小周时取当月实际工作日数（自动包含调休）
function autoWorkDaysPerMonth(mode) {
  const now = new Date();
  return Math.max(1, countWorkdaysInMonth(now.getFullYear(), now.getMonth(), mode));
}

// 联网/缓存更新节假日数据后，同步「每月工作天数」的自动值（自定义也自动计算）
function syncAutoWorkDays() {
  const days = autoWorkDaysPerMonth(settings.workDayMode);
  settings.workDaysPerMonth = days;
  const input = document.getElementById('workDaysPerMonth');
  if (!input) return;
  input.value = days;
}

// 今天按已工作时长折算的小数天：休息日/未开始为 0，上满班为 1
function getTodayWorkedDayFraction() {
  const state = getCurrentWorkState();
  if (state.isRest) return 0;
  const dailyMinutes = getPaidDailyHours() * 60;
  if (dailyMinutes <= 0) return 0;
  return Math.min(1, Math.max(0, state.workedMinutes / dailyMinutes));
}

// 已工作天数小数位：0 今天按整天计，1/2 今天按已工作时长折算并保留对应位数
function getWorkedDaysDecimals() {
  const v = parseInt(settings.workedDaysDecimals, 10);
  return isNaN(v) ? 0 : Math.min(2, Math.max(0, v));
}

// 传入 true 时只统计今天之前的完整工作日，用于本月收益按整天累计
// 否则把今天计入：小数位为 0 时按一整天，否则按已工作时长折算小数天
// 跨天夜班在凌晨仍按「班次归属日」统计，避免昨天的班次被重复算成整天
function getWorkedDaysThisMonth(excludeToday) {
  const anchor = getShiftAnchorDate(new Date());
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const todayDate = anchor.getDate();
  let count = 0;
  for (let i = 1; i <= todayDate; i++) {
    const d = new Date(year, month, i);
    const job = jobOnDate(d);
    if (!job || !isWorkdayByConfig(d, job)) continue;
    if (i < todayDate) {
      count++;
    } else if (!excludeToday) {
      // 今天：当前工作按已工作时长折算，历史工作按整天计
      if (job === settings && getWorkedDaysDecimals() > 0) count += getTodayWorkedDayFraction();
      else count += 1;
    }
  }
  return count;
}

// 本月（按班次归属月）适用范围的工作日总数：逐日归属到当时有效的工作，
// 换工作、入职当月或中间空档时，分母与「已工作天数」保持同一口径
function getMonthWorkdayTotal(anchorDate) {
  const anchor = anchorDate || getShiftAnchorDate(new Date());
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let i = 1; i <= days; i++) {
    const d = new Date(year, month, i);
    const job = jobOnDate(d);
    if (!job || !isWorkdayByConfig(d, job)) continue;
    count++;
  }
  return count;
}

// 天数展示：按配置的小数位四舍五入（最多 2 位），整数时不补 .0
function formatDays(days) {
  return String(Number(days.toFixed(getWorkedDaysDecimals())));
}

// 年度概览：逐日按所属工作（含历史工作）折算已赚 / 已过天数 / 全年天数 / 剩余预计
// 今天单独按实时工时累计，未来工作日按当前工作进行预估
function getYearOverview(year, shiftAnchor) {
  const today = new Date(shiftAnchor.getFullYear(), shiftAnchor.getMonth(), shiftAnchor.getDate());
  const todayKey = fmtDateKey(today);
  const liveJob = jobOnDate(today);
  const liveState = liveJob === settings ? getCurrentWorkState() : null;
  const cache = new Map();
  let earned = 0;
  let workedDays = 0;
  let totalDays = 0;
  let remain = 0;

  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const job = jobOnDate(d);
    if (!job || !isWorkdayByConfig(d, job)) continue;
    totalDays++;
    if (fmtDateKey(d) === todayKey) {
      if (liveJob === settings && liveState && !liveState.isRest) {
        const dailyMinutes = getPaidDailyHours() * 60;
        workedDays += getWorkedDaysDecimals() > 0 && dailyMinutes > 0
          ? Math.min(1, Math.max(0, liveState.workedMinutes / dailyMinutes))
          : 1;
        earned += liveState.earnedToday;
      } else {
        workedDays += 1;
        earned += jobDailyPay(job, d, false, cache);
      }
    } else if (d < today) {
      workedDays += 1;
      earned += jobDailyPay(job, d, false, cache);
    } else {
      remain += jobDailyPay(job, d, false, cache);
    }
  }
  return { earned, workedDays, totalDays, remain };
}

// ============ 界面更新 ============
// 计时卡片内的标识：配置了转正日期才显示，试用期内显示比例
function updatePeriodBadge() {
  const el = document.getElementById('periodBadge');
  if (!el) return;
  if (!getRegularDate()) { el.style.display = 'none'; return; }
  const factor = salaryFactorFor(new Date());
  el.style.display = '';
  if (factor < 1) {
    el.className = 'period-badge probation';
    el.textContent = `试用期 · ${Math.round(factor * 100)}%`;
  } else {
    el.className = 'period-badge';
    el.textContent = '正式期';
  }
}

function updateTimer() {
  const state = getCurrentWorkState();
  const remainingSeconds = Math.round(state.remainingMinutes * 60);
  const isMorningCommute = state.isCommuting && state.commutePhase === 'morning';
  const isEveningCommute = state.isCommuting && state.commutePhase === 'evening';
  // 通勤时段大计时自动切换到对应通勤段，其余时间仍按上下班班次计时
  const commuteLegTotal = isMorningCommute ? state.commuteBefore : (isEveningCommute ? state.commuteAfter : 0);
  const commuteLegLeft = Math.max(0, commuteLegTotal - state.commuteLegElapsed);

  updatePeriodBadge();
  updateCommuteBadge();
  const countdownEl = document.getElementById('countdownDisplay');
  const countdownLabel = document.getElementById('countdownLabel');

  if (state.isRest) {
    // 非工作日不计时，倒计时与进度都归零
    countdownEl.textContent = '--:--:--';
    countdownLabel.textContent = '今天休息，不计时';
  } else if (state.isCommuting) {
    countdownEl.textContent = formatTime(Math.round(commuteLegLeft * 60));
    countdownLabel.textContent = isMorningCommute ? '距离到岗' : '距离到家';
  } else {
    countdownEl.textContent = formatTime(remainingSeconds);
    countdownLabel.textContent = state.crossDay ? '距离下班' : '距离今天下班';
  }
  const progress = state.isCommuting
    ? (commuteLegTotal > 0 ? (state.commuteLegElapsed / commuteLegTotal) * 100 : 0)
    : state.progress;
  document.getElementById('progressFill').style.width = progress.toFixed(1) + '%';

  const statusEl = document.getElementById('workStatus');
  const statusText = document.getElementById('statusText');
  statusEl.classList.toggle('commuting', !!state.isCommuting);
  if (state.isRest) {
    statusText.textContent = '休息日';
    statusEl.classList.add('paused');
  } else if (state.isCommuting) {
    statusText.textContent = '通勤中';
    statusEl.classList.remove('paused');
  } else if (state.isLunch) {
    statusText.textContent = '午休中';
    statusEl.classList.add('paused');
  } else if (state.isWorking) {
    statusText.textContent = '工作中';
    statusEl.classList.remove('paused');
  } else {
    if (state.remainingMinutes === 0) {
      statusText.textContent = '已下班';
    } else {
      statusText.textContent = '未上班';
    }
    statusEl.classList.add('paused');
  }

  // 计时区间只按班次时间，通勤不影响上下班计时
  const shift = getShiftTimes();
  document.getElementById('startTimeLabel').textContent = minutesToClock(shift.start);
  document.getElementById('endTimeLabel').textContent =
    ((state.crossDay || shift.end >= 1440) ? '次日 ' : '') + minutesToClock(shift.end);

  // 收益：开启联动时把加班应得一并计入，加班费另起一行单独展示
  const now = new Date();
  const todayOvertime = sumOvertime(overtimeOnDay(fmtDateKey(now)));
  const monthOvertimeTotals = sumOvertime(overtimeInMonth(now.getFullYear(), now.getMonth()));
  const linked = isOvertimeLinked();
  const overtimeToday = linked ? todayOvertime.money : 0;

  document.getElementById('earnedToday').textContent = formatMoney(state.earnedToday + overtimeToday);
  setFxName('earnedFxName');
  setFxLine('earnedTodayFx', state.earnedToday + overtimeToday);
  const hourlyRate = getHourlyRate();
  document.getElementById('hourlyRate').textContent = formatMoney(hourlyRate) + '/小时';
  setFxLine('earnedHourlyFx', hourlyRate, '/小时');

  // 本月概览：按每天所属阶段（试用/正式）逐日累计，今天的收益按秒实时增长
  const monthWorked = getWorkedDaysThisMonth();
  const monthEarned = getCurrentMonthEarned();
  document.getElementById('homeMonthEarned').textContent = formatMoney(monthEarned);
  setFxName('homeMonthFxName');
  setFxLine('homeMonthEarnedFx', monthEarned);
  document.getElementById('homeMonthDays').textContent = `已工作 ${formatDays(monthWorked)} 天 / ${getMonthWorkdayTotal(state.shiftDate)} 天`;

  // 税后口径：额外展示税前对照卡片，口径标签同步显隐
  updatePreTaxCard(state, monthWorked);

  // 加班费小面板（今日 / 本月；对比口径下含税前税后）
  renderHomeOvertimePanel(todayOvertime, monthOvertimeTotals, linked);

  // 每日一句：每天轮换，节假日/调休日给出对应提示
  const todayType = dayType(new Date());
  let quotePrefix = '今日格言：';
  if (todayType === 'holiday') {
    quotePrefix = '今日法定节假日 · ';
  } else if (todayType === 'makeup') {
    quotePrefix = '今日调休补班 · ';
  }
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const quote = QUOTES[dayOfYear % QUOTES.length];
  document.getElementById('dailyQuote').textContent = quotePrefix + quote;
}

// 卡片主题：main 主色主题（绿卡 + 灰卡描绿边）/ compare 对照主题（对照色卡 + 暗卡描对照边）
const ROW_THEMES = {
  main: ['stat-card green', 'stat-card gray net'],
  compare: ['stat-card compare', 'stat-card compare-flat']
};

function applyRowTheme(row, theme) {
  const classes = ROW_THEMES[theme];
  if (!row || !classes || row.children.length < 2) return;
  row.children[0].className = classes[0];
  row.children[1].className = classes[1];
}

// 对比口径下，用税前薪资折算同一批指标，填充税前卡片
function updatePreTaxCard(state, monthWorked) {
  const row = document.getElementById('preTaxRow');
  if (!row) return;
  const mode = settings.salaryMode || DEFAULTS.salaryMode;
  const showCompare = mode === 'compare';

  // 口径标注：税前口径标「税前」，税后/对比口径标「税后」
  const tagText = mode === 'gross' ? '税前' : '税后';
  document.getElementById('earnedTag').textContent = tagText;
  document.getElementById('monthTag').textContent = tagText;

  // 对比口径下两排配色整体对调：上排（税前）用主色主题，下排（税后）用对照主题
  applyRowTheme(row, 'main');
  applyRowTheme(document.getElementById('mainStatsRow'), showCompare ? 'compare' : 'main');

  // 只有对比口径才额外并列展示税前一行
  row.style.display = showCompare ? '' : 'none';
  if (!showCompare) return;

  const grossRate = getGrossHourlyRate();
  const grossToday = state.workedMinutes * grossRate / 60;
  const grossOvertimeToday = linkedOvertime(overtimeOnDay(fmtDateKey(new Date())), undefined, true);
  document.getElementById('preTaxEarnedToday').textContent = formatMoney(grossToday + grossOvertimeToday);
  setFxName('preTaxFxName');
  setFxLine('preTaxEarnedTodayFx', grossToday + grossOvertimeToday);
  document.getElementById('preTaxHourly').textContent = formatMoney(grossRate) + '/小时';
  setFxLine('preTaxHourlyFx', grossRate, '/小时');
  const preTaxMonthEarned = getCurrentMonthEarned(true);
  document.getElementById('preTaxMonthEarned').textContent = formatMoney(preTaxMonthEarned);
  setFxName('preTaxMonthFxName');
  setFxLine('preTaxMonthEarnedFx', preTaxMonthEarned);
  document.getElementById('preTaxMonthDays').textContent = `已工作 ${formatDays(monthWorked)} 天 / ${getMonthWorkdayTotal(state.shiftDate)} 天`;
}

function updateStats() {
  updatePaidLeave();

  // 设备成本：使用时长随时间增长，需要定时重算
  updateAllDeviceCosts();

  // 生命消耗大盘 & 反向计算器
  updateLifePanel();
  updateCalculator();
  renderHourlyTrend();

  // 年度累计：开启联动时把加班应得一并计入，今天的收益按秒实时累计
  const thisYear = new Date().getFullYear();
  const now = new Date();
  const workState = getCurrentWorkState();
  const shiftAnchor = workState.shiftDate;

  const yearTotals = sumOvertime(overtimeInYear(thisYear));
  const yearOvertime = isOvertimeLinked() ? yearTotals.money : 0;

  // 年度概览逐日按所属工作（含历史工作）累计，今天单独按已工作时长实时折算
  const overview = getYearOverview(thisYear, shiftAnchor);
  const annualEarned = overview.earned + yearOvertime;
  const annualRemain = overview.remain;
  const workedDaysDisplay = overview.workedDays;
  const yearlyTotalDays = overview.totalDays;
  const annualProgress = yearlyTotalDays > 0 ? (workedDaysDisplay / yearlyTotalDays) * 100 : 0;

  const annualTotal = annualEarned + annualRemain;
  document.getElementById('annualEarned').textContent = formatMoney(annualEarned);
  document.getElementById('annualDays').textContent =
    `已过 ${formatDays(workedDaysDisplay)} 天 / ${yearlyTotalDays} 天`;
  document.getElementById('annualEarnedBar').style.width =
    (annualTotal > 0 ? Math.min(100, annualEarned / annualTotal * 100) : 0) + '%';
  document.getElementById('annualEarnedVal').textContent = formatMoney(annualEarned);
  document.getElementById('annualProgress').style.width = annualProgress.toFixed(0) + '%';
  document.getElementById('annualProgressVal').textContent = annualProgress.toFixed(0) + '%';
  document.getElementById('annualRemainBar').style.width =
    (annualTotal > 0 ? Math.min(100, annualRemain / annualTotal * 100) : 0) + '%';
  document.getElementById('annualRemainVal').textContent = formatMoney(annualRemain);
  const annualSpend = ledgerTotal(ledgerRecords.filter(r =>
    r && typeof r.date === 'string' && r.date.slice(0, 4) === String(thisYear)));
  document.getElementById('annualSpendBar').style.width =
    (annualTotal > 0 ? Math.min(100, annualSpend / annualTotal * 100) : 0) + '%';
  document.getElementById('annualSpendVal').textContent = formatMoney(annualSpend);
  renderOvertimeLine('annualOvertimeLine', overtimeInYear(thisYear));

  // 本月概览：按每天所属阶段（试用/正式）逐日累计，今天的收益随计时实时增长
  const monthWorked = getWorkedDaysThisMonth();
  const monthEarned = getCurrentMonthEarned();
  const monthTotal = getMonthlyNet();
  const monthTotalDays = getMonthWorkdayTotal(shiftAnchor);
  const monthProgress = monthTotalDays > 0 ? (monthWorked / monthTotalDays) * 100 : 0;

  document.getElementById('monthEarned').textContent = formatMoney(monthEarned);
  document.getElementById('monthDays').textContent = `已工作 ${formatDays(monthWorked)} 天 / ${monthTotalDays} 天`;
  document.getElementById('monthEarnedBar').style.width = (monthTotal > 0 ? Math.min(100, monthEarned / monthTotal * 100) : 0) + '%';
  document.getElementById('monthEarnedVal').textContent = formatMoney(monthEarned);
  document.getElementById('monthProgress').style.width = monthProgress.toFixed(0) + '%';
  document.getElementById('monthProgressVal').textContent = monthProgress.toFixed(0) + '%';
  const monthSpend = ledgerTotal(ledgerMonthRecords(currentMonthKey()));
  document.getElementById('monthSpendBar').style.width =
    (monthTotal > 0 ? Math.min(100, monthSpend / monthTotal * 100) : 0) + '%';
  document.getElementById('monthSpendVal').textContent = formatMoney(monthSpend);

  // 本月扣缴明细卡片：税前口径不做扣除，故整卡隐藏
  const taxCard = document.getElementById('monthTaxCard');
  if (taxCard) {
    const showTax = (settings.salaryMode || DEFAULTS.salaryMode) !== 'gross';
    taxCard.style.display = showTax ? '' : 'none';
    if (showTax) {
      const row = currentMonthTax(taxParamsFromSettings());
      const badge = document.getElementById('monthTaxBadge');
      badge.textContent = row.probation ? '试用期' : '正式期';
      badge.className = 'period-badge' + (row.probation ? ' probation' : '');
      document.getElementById('monthTaxDesc').innerHTML =
        (!settings.hireDate ? '未填入职日期，按全年在职估算' : '') + '个税为累计预扣法下的当月应扣';
      document.getElementById('monthTaxGross').textContent = formatMoney(row.gross);
      document.getElementById('monthTaxSocial').textContent = formatMoney(row.social);
      document.getElementById('monthTaxFund').textContent = formatMoney(row.fund);
      document.getElementById('monthTaxTax').textContent = formatMoney(row.tax);
      document.getElementById('monthTaxCum').textContent = formatMoney(row.cumTax);
      document.getElementById('monthTaxNet').textContent = formatMoney(row.net);
    }
  }
  renderOvertimeLine('monthOvertimeLine', overtimeInMonth(now.getFullYear(), now.getMonth()));
}

// ============ 时薪波动曲线 ============
// 每月时薪 = 当月薪资 ÷（每日工时 × 当月工作日数）：月薪不变，工作日多的月份每小时更便宜
// 只展示最近 12 个月，且不早于最早一段工作经历的入职当月；跨工作的月份按工作日加权
let hourlyTrendSig = '';

// 指定月份、指定工作的月薪：转正前按试用期，之后按正式期；口径跟随设置里的税前 / 税后
function getMonthlyPayForMonth(monthStart, job, grossOnly) {
  const cfg = job || settings;
  const y = monthStart.getFullYear();
  const m = monthStart.getMonth();
  const cacheKey = `${jobKeyOf(cfg)}|${y}-${m}|${grossOnly ? 1 : 0}`;
  if (jobPayCache.has(cacheKey)) return jobPayCache.get(cacheKey);

  const mode = grossOnly ? 'gross' : (settings.salaryMode || DEFAULTS.salaryMode);
  const regular = parseDateKey(getRegularDateOf(cfg));
  const probation = !!regular && monthStart < regular;
  const ratioPct = parseFloat(cfg.probationRatio);
  const ratio = (isNaN(ratioPct) || ratioPct <= 0 ? 100 : Math.min(100, ratioPct)) / 100;
  const full = Math.max(0, parseFloat(cfg.monthlySalary) || 0);
  let pay;
  if (mode === 'gross') {
    pay = full * (probation ? ratio : 1);
  } else {
    const profile = calcNetProfile(taxParamsFromJob(cfg), cfg);
    if (probation) {
      pay = profile.probation
        ? profile.probation.net
        // 跨年入职时当年明细里没有试用期月份，按正式到手 × 试用期比例近似
        : (profile.regular ? profile.regular.net * ratio : full * ratio);
    } else {
      pay = profile.regular ? profile.regular.net : full;
    }
  }
  jobPayCache.set(cacheKey, pay);
  return pay;
}

// 某段工作在指定日期的时薪：按该月满月工作日数折算，避免部分在职月份被抬高
function jobHourlyAt(job, date, grossOnly) {
  const dailyHours = getPaidDailyHours(job);
  const workDays = countWorkdaysInMonthFor(date.getFullYear(), date.getMonth(), job);
  if (!(dailyHours > 0) || !(workDays > 0)) return 0;
  const pay = getMonthlyPayForMonth(new Date(date.getFullYear(), date.getMonth(), 1), job, grossOnly);
  return pay / (dailyHours * workDays);
}

// 某段工作在某天的日收益（时薪 × 每日计时时长）
function jobDailyPay(job, date, grossOnly, cache) {
  const key = `${jobKeyOf(job)}|${date.getFullYear()}-${date.getMonth()}|${grossOnly ? 1 : 0}`;
  let hourly;
  if (cache && cache.has(key)) {
    hourly = cache.get(key);
  } else {
    hourly = jobHourlyAt(job, date, grossOnly);
    if (cache) cache.set(key, hourly);
  }
  return hourly * getPaidDailyHours(job);
}

// 曲线数据：从最早入职月（或 11 个月前）到今天所在的月份；无工作的月份跳过
function getHourlyTrendData() {
  const now = new Date();
  const curIdx = now.getFullYear() * 12 + now.getMonth();
  const jobs = getAllJobs();
  const hireIdxs = jobs
    .map(job => parseDateKey(job.hireDate || ''))
    .filter(Boolean)
    .map(d => d.getFullYear() * 12 + d.getMonth());
  const earliest = hireIdxs.length ? Math.min(...hireIdxs) : curIdx - 11;
  const startIdx = Math.max(earliest, curIdx - 11);
  const data = [];
  for (let idx = startIdx; idx <= curIdx; idx++) {
    const year = Math.floor(idx / 12);
    const month = idx % 12;
    // 逐日归属到唯一一段工作，避免当前工作与历史工作重复计数
    const counts = new Map();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const job = jobOnDate(d);
      if (!job || !isWorkdayByConfig(d, job)) continue;
      counts.set(job, (counts.get(job) || 0) + 1);
    }
    let totalDays = 0;
    let weighted = 0;
    counts.forEach((days, job) => {
      const hourly = jobHourlyAt(job, new Date(year, month, 1));
      if (!(hourly > 0)) return;
      weighted += hourly * days;
      totalDays += days;
    });
    if (totalDays > 0 && weighted > 0) {
      data.push({ year, month, workDays: totalDays, hourly: weighted / totalDays });
    } else {
      // 两段工作之间没有任职记录的月份补 0，曲线上能直接看到空档期
      data.push({ year, month, workDays: 0, hourly: 0 });
    }
  }
  return data;
}

function renderHourlyTrend() {
  const chartEl = document.getElementById('hourlyTrendChart');
  const nowEl = document.getElementById('hourlyTrendNow');
  const deltaEl = document.getElementById('hourlyTrendDelta');
  const unitEl = document.getElementById('hourlyTrendUnit');
  if (!chartEl || !nowEl || !deltaEl) return;

  const data = getHourlyTrendData();
  // 统计页每秒刷新，时薪只随设置、历史工作与月份变化，签名一致时跳过重绘
  const sig = JSON.stringify([
    settings.salaryMode,
    jobHistory.map(j => [j.id, j.endDate, ...JOB_FIELDS.map(k => j[k])]),
    settings.monthlySalary, settings.workDayMode, settings.workDaysPerMonth,
    settings.startTime, settings.endTime, settings.lunchStart, settings.lunchEnd,
    settings.commuteInHourly, settings.commuteInputMode, settings.commuteMinutes,
    settings.commuteMorning, settings.commuteEvening,
    settings.hireDate, settings.probationMonths, settings.probationRatio,
    data.map(p => [p.year, p.month, p.workDays, p.hourly.toFixed(4)])
  ]);
  if (sig === hourlyTrendSig) return;
  hourlyTrendSig = sig;

  const showEmpty = msg => {
    nowEl.textContent = '—';
    if (unitEl) unitEl.textContent = '/ 小时';
    deltaEl.className = 'hourly-trend-delta';
    deltaEl.textContent = '暂无数据';
    chartEl.innerHTML = `<div class="hourly-trend-empty">${msg}</div>`;
  };

  if (!data.length) { showEmpty('还没有可统计的工作经历，先在「设置」里填好入职日期'); return; }
  if (!data.some(p => p.hourly > 0)) { showEmpty('先去「设置」里填上月薪，时薪曲线才有得画'); return; }

  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  nowEl.textContent = formatMoney(last.hourly);
  // 若最近一个有数据的月份不是本月（例如空档期），单位跟着实际月份走
  const now = new Date();
  if (unitEl) {
    const isCurrentMonth = last.year === now.getFullYear() && last.month === now.getMonth();
    unitEl.textContent = isCurrentMonth ? '/ 小时 · 本月' : `/ 小时 · ${last.month + 1} 月`;
  }

  deltaEl.className = 'hourly-trend-delta';
  if (!prev) {
    deltaEl.textContent = '入职首月';
  } else {
    const diff = last.hourly - prev.hourly;
    if (Math.abs(diff) < 0.005) {
      deltaEl.textContent = '与上月持平';
    } else {
      const up = diff > 0;
      deltaEl.classList.add(up ? 'up' : 'down');
      deltaEl.textContent = `比上月${up ? '多赚' : '少赚'} ${formatMoney(Math.abs(diff))}/小时`;
    }
  }

  // 小折线图：固定 viewBox，随卡片宽度等比缩放
  const W = 340;
  const H = 136;
  const padL = 38;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = data.map(p => p.hourly);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  let min = dataMin;
  let max = dataMax;
  if (dataMin <= 0) {
    // 存在空档月时把 0 作为纵轴底边，空档期会直接落到最底部
    min = 0;
    max = Math.max(dataMax, 1) * 1.12;
  } else if (max - min < 0.5) {
    min -= 1;
    max += 1;
  } else {
    const pad = (max - min) * 0.18;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const xOf = i => data.length > 1 ? padL + (plotW * i) / (data.length - 1) : padL + plotW / 2;
  const yOf = v => padT + plotH * (1 - (v - min) / span);

  const axisMoney = v => '¥' + (v >= 100 ? Math.round(v) : v.toFixed(1));
  const gridVals = [dataMax, (dataMax + dataMin) / 2, dataMin];
  const grid = gridVals.map((v, i) => {
    const y = yOf(v);
    return `<line x1="${padL}" y1="${y.toFixed(2)}" x2="${W - padR}" y2="${y.toFixed(2)}"`
      + ` stroke="#262626" stroke-width="1"${i === 2 ? '' : ' stroke-dasharray="3 3"'}/>`
      + `<text x="${padL - 6}" y="${(y + 3).toFixed(2)}" text-anchor="end" font-size="9" fill="#666">${axisMoney(v)}</text>`;
  }).join('');

  const pts = data.map((p, i) => [xOf(i), yOf(p.hourly)]);
  const lineD = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const baseY = (padT + plotH).toFixed(2);
  const areaD = `${lineD} L${pts[pts.length - 1][0].toFixed(2)} ${baseY}`
    + ` L${pts[0][0].toFixed(2)} ${baseY} Z`;

  const dots = data.map((p, i) => {
    const [x, y] = pts[i];
    const isLast = i === data.length - 1;
    const isGap = !(p.hourly > 0);
    const tip = isGap
      ? `${p.year} 年 ${p.month + 1} 月 · 无工作`
      : `${p.year} 年 ${p.month + 1} 月 · ${p.workDays} 个工作日 · ${formatMoney(p.hourly)}/小时`;
    const highlight = isLast && !isGap;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${highlight ? 4 : 2.5}"`
      + ` fill="${isGap ? '#1a1a1a' : (highlight ? '#c8ff00' : '#0f0f0f')}"`
      + ` stroke="${isGap ? '#555' : '#c8ff00'}" stroke-width="${highlight ? 0 : 1.6}">`
      + `<title>${tip}</title></circle>`;
  }).join('');

  // 月份标签：9 个以内全显示，更多时隔月显示并保证最后一个月有标签
  const labels = data.map((p, i) => {
    const show = data.length <= 9 || i === 0 || i === data.length - 1
      || (i % 2 === 0 && data.length - 1 - i >= 2);
    if (!show) return '';
    return `<text x="${xOf(i).toFixed(2)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#777">`
      + `${p.month + 1}月</text>`;
  }).join('');

  chartEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img"`
    + ` aria-label="最近 ${data.length} 个月的时薪变化">`
    + '<defs><linearGradient id="hourlyTrendFill" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="rgba(200,255,0,.22)"/>'
    + '<stop offset="100%" stop-color="rgba(200,255,0,0)"/>'
    + '</linearGradient></defs>'
    + grid
    + `<path d="${areaD}" fill="url(#hourlyTrendFill)"/>`
    + `<path d="${lineD}" fill="none" stroke="#c8ff00" stroke-width="1.8"`
    + ' stroke-linecap="round" stroke-linejoin="round"/>'
    + dots
    + labels
    + '</svg>';
}

// 统计页：列出该周期的加班费 / 调休时长，没有就不占位；按当前口径只取对应来源的记录
function renderOvertimeLine(id, match) {
  const el = document.getElementById(id);
  if (!el) return;
  if ((settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave') {
    const hours = sumLeaveEarned(match);
    if (hours <= 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.textContent = `调休 ${hours.toFixed(1)} 小时`;
    return;
  }
  const totals = sumOvertime(match);
  if (totals.hours <= 0) { el.style.display = 'none'; return; }
  el.style.display = '';
  // 未开启联动时金额不在上面的合计里，补一句说明避免误读
  el.textContent = `加班费 ${formatMoney(totals.money)} · 共 ${totals.hours.toFixed(1)} 小时`
    + (isOvertimeLinked() ? '' : '（未计入）');
}

// 计时页：加班费小面板；调休口径展示调休结余，对比口径下按税前 / 税后两组并列
function renderHomeOvertimePanel(todayTotals, monthTotals, linked) {
  const panel = document.getElementById('homeOvertimePanel');
  const grid = document.getElementById('homeOvertimeGrid');
  if (!panel || !grid) return;
  const panelMode = overtimePanelMode();
  const isLeave = (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave';
  const titleEl = document.getElementById('homeOvertimeTitle');
  const noteEl = document.getElementById('homeOvertimeNote');

  const cell = (label, valueText, cls) =>
    `<div class="overtime-stat${cls ? ' ' + cls : ''}">`
    + `<div class="val">${valueText}</div><div class="lbl">${label}</div></div>`;

  // 调休口径：展示总调休 / 已调休 / 剩余调休
  if (isLeave) {
    const earned = totalLeaveEarned();
    const used = totalLeaveUsed();
    // 关闭展示、或「无数据不展示」且没有任何调休时都不占位
    if (panelMode === 'off' || (panelMode === 'auto' && earned <= 0 && used <= 0)) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    if (titleEl) titleEl.textContent = '🌴 调休';
    if (noteEl) noteEl.textContent = '';
    grid.classList.add('cols-3');
    grid.innerHTML =
      cell('总调休', formatHours(earned))
      + cell('已调休', formatHours(used))
      + cell('剩余调休', formatHours(earned - used));
    return;
  }

  grid.classList.remove('cols-3');
  if (titleEl) titleEl.textContent = '🌙 加班费';
  // 关闭展示、或「无数据不展示」且没有任何加班时都不占位
  if (panelMode === 'off' || (panelMode === 'auto' && todayTotals.hours <= 0 && monthTotals.hours <= 0)) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  if (noteEl) noteEl.textContent = linked ? '' : '· 未计入合计';

  if ((settings.salaryMode || DEFAULTS.salaryMode) === 'compare') {
    // 顺序与上方卡片一致：先税前、后税后
    const now = new Date();
    const grossToday = sumOvertime(overtimeOnDay(fmtDateKey(now)), undefined, true).money;
    const grossMonth = sumOvertime(overtimeInMonth(now.getFullYear(), now.getMonth()), undefined, true).money;
    grid.innerHTML = cell('税前 · 今日', formatMoney(grossToday))
      + cell('税前 · 本月', formatMoney(grossMonth))
      + cell('税后 · 今日', formatMoney(todayTotals.money), 'compare')
      + cell('税后 · 本月', formatMoney(monthTotals.money), 'compare');
    return;
  }
  grid.innerHTML = cell('今日', formatMoney(todayTotals.money)) + cell('本月', formatMoney(monthTotals.money));
}

// ============ 带薪离岗 ============
function togglePaidLeave() {
  if (paidLeaveActive) {
    // 结束本次计时并结算收益
    const earned = (Date.now() - paidLeaveStart) / 1000 / 60 * getMinuteRate();
    paidLeaveSessions.push({
      start: paidLeaveStart,
      end: Date.now(),
      earned: earned
    });
    saveLeave();
    paidLeaveActive = false;
    paidLeaveStart = null;
    document.getElementById('paidLeaveBtn').textContent = '开始计时';
    showToast('带薪离席结束！赚了' + formatMoney(earned));
  } else {
    paidLeaveActive = true;
    paidLeaveStart = Date.now();
    document.getElementById('paidLeaveBtn').textContent = '结束并结算';
    showToast('开始带薪离席！');
  }
  updatePaidLeave();
}

// 清空带薪离席的全部记录（含正在进行的计时）
function resetPaidLeave() {
  if (!paidLeaveActive && paidLeaveSessions.length === 0) {
    showToast('暂无可重置的记录');
    return;
  }
  if (!confirm('确定重置带薪离席？已记录的时长和金额将全部清空。')) return;

  paidLeaveActive = false;
  paidLeaveStart = null;
  paidLeaveSessions = [];
  saveLeave();
  document.getElementById('paidLeaveBtn').textContent = '开始计时';
  updatePaidLeave();
  showToast('带薪离席已重置');
}

function updatePaidLeave() {
  let totalSeconds = 0;
  let totalEarned = 0;

  if (paidLeaveActive && paidLeaveStart) {
    totalSeconds = (Date.now() - paidLeaveStart) / 1000;
    totalEarned = totalSeconds / 60 * getMinuteRate();
  }

  for (const s of paidLeaveSessions) {
    totalEarned += s.earned || 0;
  }

  if (paidLeaveActive && paidLeaveStart) {
    document.getElementById('paidLeaveTimer').textContent = formatTime(totalSeconds);
    document.getElementById('paidLeaveEarned').textContent = formatMoney(totalEarned);
  } else {
    // 未在计时：展示历史累计时长与收益
    let totalSessionSeconds = 0;
    for (const s of paidLeaveSessions) {
      totalSessionSeconds += (s.end - s.start) / 1000;
    }
    document.getElementById('paidLeaveTimer').textContent = formatTime(totalSessionSeconds);
    document.getElementById('paidLeaveEarned').textContent = formatMoney(totalEarned);
  }

  document.getElementById('paidLeaveCount').textContent = `已记录 ${paidLeaveSessions.length} 次`;
}

// ============ 设备成本 ============
function saveDevices() {
  localStorage.setItem('qianxwk_devices', JSON.stringify(devices));
}

function renderDevices() {
  const list = document.getElementById('deviceList');
  list.innerHTML = '';
  devices.forEach((d, idx) => {
    const item = document.createElement('div');
    item.className = 'device-item';
    item.innerHTML = `
      <button class="device-del" onclick="deleteDevice(${idx})" title="删除">×</button>
      <div class="field-group device-name">
        <label>设备名称</label>
        <input type="text" value="${escapeAttr(d.name || '')}" placeholder="例如：耳机" oninput="updateDevice(${idx},'name',this.value)">
      </div>
      <div class="cost-fields">
        <div class="field-group">
          <label>设备价格 (¥)</label>
          <input type="number" value="${escapeAttr(d.price)}" placeholder="请输入设备价格" oninput="updateDevice(${idx},'price',this.value)">
        </div>
        <div class="field-group">
          <label>购买时间</label>
          <input type="text" class="picker-input" data-picker="date" readonly placeholder="YYYY/MM/DD" value="${escapeAttr(formatDateSlash(d.purchase))}" max="${fmtDateKey(new Date())}" oninput="updateDevice(${idx},'purchase',this.value)">
        </div>
      </div>
      <div class="cost-result">
        <div class="rate" id="deviceRate-${idx}">¥0.00</div>
        <div class="rate-label">每小时使用成本</div>
        <div class="usage" id="deviceUsage-${idx}">未填写购买时间</div>
      </div>
    `;
    list.appendChild(item);
    updateDeviceCost(idx);
  });

  // 达到上限时把「添加」按钮置灰并提示
  const addBtn = document.querySelector('.add-device');
  if (addBtn) {
    const limitReached = devices.length >= MAX_DEVICES;
    addBtn.textContent = limitReached ? '最多 ' + MAX_DEVICES + ' 台设备' : '+ 添加设备';
    addBtn.classList.toggle('limit', limitReached);
  }
}

function escapeAttr(val) {
  return String(val === undefined || val === null ? '' : val)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// 只更新状态与该设备的成本，不重绘列表（避免输入框失焦）
function updateDevice(idx, field, value) {
  if (!devices[idx]) return;
  devices[idx][field] = value;
  saveDevices();
  updateDeviceCost(idx);
}

// 从购买时间（YYYY-MM-DD）到现在经过的小时数；未填或日期非法返回 0
function getUsedHours(purchase) {
  if (!purchase) return 0;
  const d = parseDateKey(purchase);
  if (!d) return 0;
  return (Date.now() - d.getTime()) / 3600000;
}

function formatUsage(hours) {
  if (hours <= 0) return '未填写购买时间';
  if (hours < 24) return '已使用 ' + hours.toFixed(1) + ' 小时';
  return '已使用 ' + Math.floor(hours / 24) + ' 天 · 约 ' + Math.round(hours) + ' 小时';
}

function updateDeviceCost(idx) {
  const d = devices[idx];
  const rateEl = document.getElementById('deviceRate-' + idx);
  if (!d || !rateEl) return;

  const price = parseFloat(d.price) || 0;
  const usedHours = getUsedHours(d.purchase);
  const rate = usedHours > 0 ? price / usedHours : 0;

  rateEl.textContent = '¥' + rate.toFixed(2);
  const usageEl = document.getElementById('deviceUsage-' + idx);
  if (usageEl) usageEl.textContent = formatUsage(usedHours);
}

// 使用时长随时间增长，统计页每秒刷新时同步更新
function updateAllDeviceCosts() {
  devices.forEach((d, idx) => updateDeviceCost(idx));
}

function addDevice() {
  if (devices.length >= MAX_DEVICES) {
    showToast('最多添加 ' + MAX_DEVICES + ' 台设备');
    return;
  }
  devices.push({ name: '', price: '', purchase: '' });
  saveDevices();
  renderDevices();
  const items = document.querySelectorAll('#deviceList .device-name input');
  if (items.length) items[items.length - 1].focus();
}

function deleteDevice(idx) {
  devices.splice(idx, 1);
  saveDevices();
  renderDevices();
  showToast('已删除');
}

// ============ 加班 ============
const OVERTIME_KEY = 'qianxwk_overtime';
const LEAVE_USED_KEY = 'qianxwk_leave_used';

function saveOvertime() {
  localStorage.setItem(OVERTIME_KEY, JSON.stringify(overtimeRecords));
}

function saveLeaveUsed() {
  localStorage.setItem(LEAVE_USED_KEY, JSON.stringify(leaveUsedRecords));
}

// 小时数展示（保留 1 位）
function formatHours(h) {
  return (Math.round(h * 10) / 10).toFixed(1) + ' 小时';
}

// 加班记录的来源口径：'money' 给钱 / 'leave' 调休；历史无标记的记录归为给钱
function overtimeSettleOf(record) {
  return record.settle === 'leave' ? 'leave' : 'money';
}

// 累计「调休模式」加班换来的可调休时长
function totalLeaveEarned() {
  let h = 0;
  overtimeRecords.forEach(r => {
    if (overtimeSettleOf(r) !== 'leave') return;
    h += overtimeHours(r);
  });
  return h;
}

// 按日期条件汇总「调休模式」加班换来的时长（小时）
function sumLeaveEarned(match) {
  let hours = 0;
  overtimeRecords.forEach(r => {
    if (overtimeSettleOf(r) !== 'leave') return;
    const d = parseDateKey(r.date);
    if (!d || !match(d)) return;
    hours += overtimeHours(r);
  });
  return hours;
}

// 已调休记录折算成小时数：按「天」录入时，一天按当前制度的每日工时算
function leaveUsedHours(record) {
  const amount = Math.max(0, parseFloat(record.amount) || 0);
  return record.unit === 'day' ? amount * getDailyHours() : amount;
}

// 累计已使用的调休时长
function totalLeaveUsed() {
  let h = 0;
  leaveUsedRecords.forEach(r => { h += leaveUsedHours(r); });
  return h;
}

// 按天录入时，时长框固定显示当天的应上班小时数
function dailyHoursValue() {
  return String(Math.round(getDailyHours() * 10) / 10);
}

// 当前选中的加班倍率：预设档位直接取，自定义取输入框
function currentOvertimeRate() {
  if (overtimeRateMode === 'custom') {
    return parseFloat(document.getElementById('overtimeRate').value) || 0;
  }
  return parseFloat(overtimeRateMode) || 0;
}

function selectOvertimeRate(value) {
  overtimeRateMode = value;
  document.querySelectorAll('#overtimeRateMode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.rate === value);
  });
  // 只有「自定义」才露出输入框
  const input = document.getElementById('overtimeRate');
  const isCustom = value === 'custom';
  input.style.display = isCustom ? '' : 'none';
  if (!isCustom) input.value = '';
  updateOvertimePreview();
}

function selectOvertimeUnit(unit) {
  overtimeUnit = unit;
  document.querySelectorAll('#overtimeUnit .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.unit === unit);
  });
  // 按天录入时一次只记一天：自动带入应上班小时数并锁住，不可手改
  const amountInput = document.getElementById('overtimeAmount');
  amountInput.disabled = unit === 'day';
  amountInput.value = unit === 'day' ? dailyHoursValue() : '';
  updateOvertimePreview();
}

function selectLeaveUnit(unit) {
  leaveUnit = unit;
  document.querySelectorAll('#leaveUnit .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.unit === unit);
  });
  // 按天录入时一次只记一天：自动带入应上班小时数并锁住，不可手改
  const amountInput = document.getElementById('leaveUsedAmount');
  amountInput.disabled = unit === 'day';
  amountInput.value = unit === 'day' ? dailyHoursValue() : '';
}

// 记录折算成小时数：按「天」录入时，一天按该记录所属工作的每日工时算
function overtimeHours(record) {
  const amount = Math.max(0, parseFloat(record.amount) || 0);
  if (record.unit !== 'day') return amount;
  const d = parseDateKey(record.date);
  const job = d ? jobOnDate(d) : null;
  return amount * getDailyHours(job || settings);
}

// 应得加班费 = 小时数 × 该记录所属工作的时薪 × 倍率
function overtimeEarned(record, hourlyRate) {
  const rate = Math.max(0, parseFloat(record.rate) || 0);
  const base = typeof hourlyRate === 'number' ? hourlyRate : hourlyRateForDate(record.date);
  return overtimeHours(record) * base * rate;
}

// 计时页联动：仅「给钱」且开启联动时，才把加班应得算进首页
function isOvertimeLinked() {
  return (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'money' && !!settings.overtimeSync;
}

// 按日期条件汇总「给钱模式」加班，返回 { money, hours }；不受联动开关影响
// hourlyRate 省略时按每条记录所属工作的时薪计算，兼容历史工作
function sumOvertime(match, hourlyRate, grossOnly) {
  let money = 0;
  let hours = 0;
  overtimeRecords.forEach(r => {
    if (overtimeSettleOf(r) !== 'money') return;
    const d = parseDateKey(r.date);
    if (!d || !match(d)) return;
    hours += overtimeHours(r);
    money += typeof hourlyRate === 'number'
      ? overtimeEarned(r, hourlyRate)
      : overtimeEarned(r, hourlyRateForDate(r.date, grossOnly));
  });
  return { money: money, hours: hours };
}

// 计入计时页 / 统计的加班金额（受「给钱 + 计入」开关控制）
function linkedOvertime(match, hourlyRate, grossOnly) {
  return isOvertimeLinked() ? sumOvertime(match, hourlyRate, grossOnly).money : 0;
}

// 常用日期范围
function overtimeOnDay(dateKey) {
  return d => fmtDateKey(d) === dateKey;
}

function overtimeInMonth(year, month) {
  return d => d.getFullYear() === year && d.getMonth() === month;
}

function overtimeInYear(year) {
  return d => d.getFullYear() === year;
}

// 加班设置已挪到加班页，不再走「保存参数」，改动即时落盘（只覆盖这几个键，避免带上其它未保存的表单改动）
function persistOvertimeSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('qianxwk_settings')) || {}; } catch (e) { saved = {}; }
  saved.overtimeSettle = settings.overtimeSettle;
  saved.overtimeSync = settings.overtimeSync;
  saved.overtimePanelShow = settings.overtimePanelShow;
  localStorage.setItem('qianxwk_settings', JSON.stringify(saved));
}

// 加班页：加班结算方式（给钱 / 调休）
function selectOvertimeSettle(mode) {
  settings.overtimeSettle = mode;
  document.querySelectorAll('#overtimeSettle .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.settle === mode);
  });
  const isLeave = mode === 'leave';

  const settleHint = document.getElementById('overtimeSettleHint');
  if (settleHint) {
    settleHint.textContent = isLeave
      ? '加班不计金额，累计的时长用来换调休'
      : '加班按倍率折算成应得金额';
  }
  // 调休不产生金额，自动切到「不计入」并锁住该项
  if (isLeave) {
    settings.overtimeSync = false;
    document.querySelectorAll('#overtimeSync .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.sync === 'off');
    });
  }
  updateOvertimeSyncDisabled();
  renderOvertime();
  updateOvertimePreview();
  persistOvertimeSettings();
}

// 「加班金额计入计时页」的可用状态：调休模式、或计时页已隐藏卡片时都不可改
function updateOvertimeSyncDisabled() {
  const isLeave = (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave';
  const panelHidden = overtimePanelMode() === 'off';
  const syncSeg = document.getElementById('overtimeSync');
  if (syncSeg) syncSeg.classList.toggle('disabled', isLeave || panelHidden);
  const syncHint = document.getElementById('overtimeSyncHint');
  if (syncHint) {
    if (isLeave) syncHint.textContent = '调休模式不产生金额，无需计入';
    else if (panelHidden) syncHint.textContent = '计时页已隐藏加班费卡片，无需计入';
    else syncHint.textContent = '计入后，加班金额会加进计时页的今日 / 本月已赚';
  }
}

// 加班页：加班金额是否计入计时页
function selectOvertimeSync(on) {
  settings.overtimeSync = !!on;
  document.querySelectorAll('#overtimeSync .seg-btn').forEach(b => {
    b.classList.toggle('active', (b.dataset.sync === 'on') === !!on);
  });
  persistOvertimeSettings();
}

// 加班页：计时页加班费卡片展示模式；兼容旧布尔值：true → always / false → off
function overtimePanelMode() {
  const v = settings.overtimePanelShow;
  if (v === 'always' || v === 'auto' || v === 'off') return v;
  return v === false ? 'off' : 'always';
}

// 加班页：设置计时页加班费卡片的展示方式
function selectOvertimePanelShow(mode) {
  if (mode !== 'always' && mode !== 'auto' && mode !== 'off') mode = 'always';
  settings.overtimePanelShow = mode;
  document.querySelectorAll('#overtimePanelShow .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.show === mode);
  });
  const hint = document.getElementById('overtimePanelShowHint');
  if (hint) {
    hint.textContent = mode === 'off'
      ? '计时页不再显示加班费小面板，数据仍可在加班页查看'
      : (mode === 'auto'
        ? '有加班记录时在计时页显示今日 / 本月加班费小面板，没有则不占位'
        : '计时页始终显示今日 / 本月加班费小面板');
  }
  // 隐藏卡片后，加班费也就不在计时页体现，自动切到「不计入」并锁住该项
  if (mode === 'off') {
    settings.overtimeSync = false;
    document.querySelectorAll('#overtimeSync .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.sync === 'off');
    });
  }
  updateOvertimeSyncDisabled();
  persistOvertimeSettings();
}

function updateOvertimePreview() {
  const preview = document.getElementById('overtimePreview');
  if (!preview) return;
  // 调休模式不折算金额，只提示结算方式
  if ((settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave') {
    preview.classList.remove('rate-cols');
    preview.textContent = '调休';
    return;
  }
  const amount = parseFloat(document.getElementById('overtimeAmount').value) || 0;
  const rate = currentOvertimeRate();
  // 按天录入时时长框显示的是应上班小时数，折算固定按一天算
  const hours = overtimeUnit === 'day' ? getDailyHours() : amount;
  const net = hours * getHourlyRate() * rate;

  // 对比口径：税前、税后都算出来并排展示
  if ((settings.salaryMode || DEFAULTS.salaryMode) === 'compare') {
    const gross = hours * getGrossHourlyRate() * rate;
    preview.innerHTML =
      `<div class="rate-col"><div class="rate-val">${formatMoney(gross)}</div><div class="rate-cap">税前</div></div>` +
      `<div class="rate-col"><div class="rate-val">${formatMoney(net)}</div><div class="rate-cap">税后</div></div>`;
    preview.classList.add('rate-cols');
    return;
  }
  preview.classList.remove('rate-cols');
  // 单一口径：金额下方标注当期是税前还是税后
  const tag = (settings.salaryMode || DEFAULTS.salaryMode) === 'gross' ? '税前' : '税后';
  preview.innerHTML = `${formatMoney(net)}<div class="rate-cap">${tag}</div>`;
}

function addOvertime() {
  const isLeaveMode = (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave';
  // 按天录入时固定记一天
  const amount = overtimeUnit === 'day' ? 1 : parseFloat(document.getElementById('overtimeAmount').value);
  const rate = currentOvertimeRate();
  if (!amount || amount <= 0) { showToast('先填加班时长'); return; }
  // 调休模式不折算金额，不需要倍率
  if (!isLeaveMode && (!rate || rate <= 0)) {
    showToast(overtimeRateMode === 'custom' ? '先填自定义倍率' : '先选加班倍率');
    return;
  }

  overtimeRecords.unshift({
    date: document.getElementById('overtimeDate').value || fmtDateKey(new Date()),
    amount: amount,
    unit: overtimeUnit,
    rate: rate || 1,
    settle: isLeaveMode ? 'leave' : 'money',
    ts: Date.now()
  });
  saveOvertime();
  renderOvertime();

  document.getElementById('overtimeAmount').value = overtimeUnit === 'day' ? dailyHoursValue() : '';
  // 预设档位保留选择，方便连着记几笔；自定义则清空输入框
  if (overtimeRateMode === 'custom') document.getElementById('overtimeRate').value = '';
  updateOvertimePreview();
  showToast('已记下这笔加班');
}

function deleteOvertime(idx) {
  overtimeRecords.splice(idx, 1);
  saveOvertime();
  renderOvertime();
  showToast('已删除');
}

function formatOvertimeDate(key) {
  return formatDateSlash(key);
}

function renderOvertime() {
  const list = document.getElementById('overtimeList');
  if (!list) return;

  const isLeave = (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave';
  const isCompare = (settings.salaryMode || DEFAULTS.salaryMode) === 'compare';
  // 单一口径下的口径标注：税前 / 税后
  const modeTag = (settings.salaryMode || DEFAULTS.salaryMode) === 'gross' ? '税前' : '税后';
  const summary = document.getElementById('overtimeSummary');

  // 只取当前口径的加班记录（给钱 / 调休），两种来源互不串
  const modeRecords = overtimeRecords.filter(r => overtimeSettleOf(r) === (isLeave ? 'leave' : 'money'));

  if (!modeRecords.length && !(isLeave && leaveUsedRecords.length)) {
    summary.textContent = '还没有记录。被留下加班的那天，回来记一笔。';
  } else if (isLeave) {
    // 调休口径：加班时长与已调休合并成一本账
    const earned = totalLeaveEarned();
    const used = totalLeaveUsed();
    summary.textContent = `加班 ${formatHours(earned)} · 已调休 ${formatHours(used)} · 剩余 ${formatHours(earned - used)}`;
  } else if (isCompare) {
    // 对比口径：税前、税后各算一份
    let net = 0;
    let gross = 0;
    modeRecords.forEach(r => {
      net += overtimeEarned(r);
      gross += overtimeEarned(r, hourlyRateForDate(r.date, true));
    });
    summary.textContent = `共 ${modeRecords.length} 笔 · 应得合计 税前 ${formatMoney(gross)} / 税后 ${formatMoney(net)}`;
  } else {
    let total = 0;
    modeRecords.forEach(r => { total += overtimeEarned(r); });
    summary.textContent = `共 ${modeRecords.length} 笔 · 应得合计 ${formatMoney(total)}（${modeTag}）`;
  }

  // 把「加班」与「已调休」记录合并成一条列表，按新增顺序倒序（不按类型分组）
  const recordTs = r => {
    if (r.ts) return r.ts;
    const d = parseDateKey(r.date);
    return d ? d.getTime() : 0;
  };
  let rows = [];
  overtimeRecords.forEach((r, i) => {
    if (overtimeSettleOf(r) !== (isLeave ? 'leave' : 'money')) return;
    rows.push({ kind: 'overtime', r: r, i: i, ts: recordTs(r) });
  });
  if (isLeave) {
    leaveUsedRecords.forEach((r, i) => rows.push({ kind: 'leave', r: r, i: i, ts: recordTs(r) }));
    if (recordFilter === 'overtime') rows = rows.filter(x => x.kind === 'overtime');
    else if (recordFilter === 'leave') rows = rows.filter(x => x.kind === 'leave');
  }
  rows.sort((a, b) => b.ts - a.ts);

  list.innerHTML = '';
  rows.forEach(row => {
    const r = row.r;
    const item = document.createElement('div');
    item.className = 'overtime-item';
    let meta;
    let amountHtml;
    let extraClass = '';
    if (row.kind === 'leave') {
      meta = '已调休';
      amountHtml = `-${formatHours(leaveUsedHours(r))}`;
      extraClass = ' used';
    } else {
      const duration = r.unit === 'day' ? `${r.amount} 天` : `${r.amount} 小时`;
      // 调休模式下不折算金额，也不展示倍率
      meta = isLeave ? duration : `${duration} · ${r.rate} 倍`;
      if (isLeave) {
        amountHtml = `+${formatHours(overtimeHours(r))}`;
      } else if (isCompare) {
        amountHtml =
          `<div>税前 ${formatMoney(overtimeEarned(r, hourlyRateForDate(r.date, true)))}</div>` +
          `<div>税后 ${formatMoney(overtimeEarned(r))}</div>`;
        extraClass = ' compare';
      } else {
        amountHtml = `<span class="overtime-basis">${modeTag}</span>${formatMoney(overtimeEarned(r))}`;
      }
    }
    const delCall = row.kind === 'leave' ? `deleteLeaveUsed(${row.i})` : `deleteOvertime(${row.i})`;
    item.innerHTML = `
      <button class="overtime-del" onclick="${delCall}" title="删除">×</button>
      <div>
        <div class="overtime-date">${formatOvertimeDate(r.date)}</div>
        <div class="overtime-meta">${meta}</div>
      </div>
      <div class="overtime-amount${extraClass}">${amountHtml}</div>
    `;
    list.appendChild(item);
  });

  syncLeaveUI();
}

function addLeaveUsed() {
  // 按天录入时固定记一天
  const amount = leaveUnit === 'day' ? 1 : parseFloat(document.getElementById('leaveUsedAmount').value);
  if (!amount || amount <= 0) { showToast('先填调休时长'); return; }

  leaveUsedRecords.unshift({
    date: document.getElementById('leaveUsedDate').value || fmtDateKey(new Date()),
    amount: amount,
    unit: leaveUnit,
    ts: Date.now()
  });
  saveLeaveUsed();
  renderOvertime();
  document.getElementById('leaveUsedAmount').value = leaveUnit === 'day' ? dailyHoursValue() : '';
  showToast('已记下这笔调休');
}

function deleteLeaveUsed(idx) {
  leaveUsedRecords.splice(idx, 1);
  saveLeaveUsed();
  renderOvertime();
  showToast('已删除');
}

// 「记一笔」卡片：切换记加班 / 记调休
function selectRecordType(type) {
  recordType = type === 'leave' ? 'leave' : 'overtime';
  document.querySelectorAll('#recordType .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === recordType);
  });
  applyRecordType();
}

// 记录列表筛选：全部 / 只看加班 / 只看调休
function selectRecordFilter(filter) {
  recordFilter = (filter === 'overtime' || filter === 'leave') ? filter : 'all';
  document.querySelectorAll('#recordFilter .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === recordFilter);
  });
  renderOvertime();
}

// 按当前记录类型显示对应表单，并同步卡片标题 / 说明
function applyRecordType() {
  const isLeaveType = recordType === 'leave';
  const isLeaveMode = (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave';
  const overtimeForm = document.getElementById('overtimeForm');
  const leaveForm = document.getElementById('leaveForm');
  if (overtimeForm) overtimeForm.style.display = isLeaveType ? 'none' : '';
  if (leaveForm) leaveForm.style.display = isLeaveType ? '' : 'none';
  const title = document.getElementById('recordCardTitle');
  const desc = document.getElementById('recordCardDesc');
  if (title) title.textContent = isLeaveType ? '🌴 记一笔调休' : '🌙 记一笔加班';
  if (desc) {
    if (isLeaveType) desc.textContent = '调休用掉多少就记多少，用来算还剩多少可调休';
    else if (isLeaveMode) desc.textContent = '按加班那天填，累计的时长用来换调休';
    else desc.textContent = '按加班那天填。倍率选工作日 1.5、休息日 2、法定节假日 3，也可自定义';
  }

  // 调休模式下加班只累计时长、不折算金额，隐藏薪资倍率与金额预览
  const rateGroup = document.getElementById('overtimeRateGroup');
  if (rateGroup) rateGroup.style.display = isLeaveMode ? 'none' : '';
  const previewBox = document.getElementById('overtimePreviewBox');
  if (previewBox) previewBox.style.display = isLeaveMode ? 'none' : '';
}

// 加班页：调休模式下才显示「记录类型」切换与记录筛选，并同步记录卡片标题
function syncLeaveUI() {
  const isLeave = (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave';

  const typeFields = document.getElementById('recordTypeFields');
  if (typeFields) typeFields.style.display = isLeave ? '' : 'none';

  // 非调休模式没有「记调休」入口，强制回到记加班；筛选也回到全部
  if (!isLeave && recordType !== 'overtime') recordType = 'overtime';
  selectRecordType(recordType);

  const filterFields = document.getElementById('recordFilterFields');
  if (filterFields) filterFields.style.display = isLeave ? '' : 'none';
  if (!isLeave && recordFilter !== 'all') recordFilter = 'all';
  document.querySelectorAll('#recordFilter .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === recordFilter);
  });

  const title = document.getElementById('recordListTitle');
  if (title) title.textContent = isLeave ? '加班 / 调休记录' : '加班记录';
}

function initOvertime() {
  const dateInput = document.getElementById('overtimeDate');
  if (dateInput) dateInput.value = formatDateSlash(fmtDateKey(new Date()));
  const leaveDateInput = document.getElementById('leaveUsedDate');
  if (leaveDateInput) leaveDateInput.value = formatDateSlash(fmtDateKey(new Date()));
  renderOvertime();
  updateOvertimePreview();
}

// ============ 生命消耗大盘 ============
// 入职日期存于当前工作设置；历史工作各有自己的入职 / 离职日期，大盘按时间轴累计

// 某段工作从入职日到指定结束日（含）的工作日数、累计工时与已换工资
function getJobWorkdayStats(job, endDate) {
  const hire = parseDateKey(job.hireDate || '');
  if (!hire) return { workDays: 0, hours: 0, earned: 0 };
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const d = new Date(hire.getFullYear(), hire.getMonth(), hire.getDate());
  if (d > end) return { workDays: 0, hours: 0, earned: 0 };
  const dailyHours = getPaidDailyHours(job);
  const cache = new Map();
  let workDays = 0;
  let earned = 0;
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    if (!isWorkdayByConfig(d, job)) continue;
    workDays++;
    earned += jobDailyPay(job, d, false, cache);
  }
  return { workDays, hours: workDays * dailyHours, earned };
}

// 大额金额压缩显示，避免窄屏把卡片顶破
function fmtMoneyCompact(val) {
  if (val >= 100000000) return '¥' + (val / 100000000).toFixed(1) + '亿';
  if (val >= 10000) return '¥' + (val / 10000).toFixed(1) + '万';
  return '¥' + Math.round(val).toLocaleString();
}

// 生命消耗大盘数据：累计工时、最早入职 / 打工天数、折合生命与已换工资（含历史工作）
function getLifeStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let workDays = 0;
  let totalHours = 0;
  let totalEarned = 0;
  let jobCount = 0;
  let firstHire = null;

  getAllJobs().forEach(job => {
    const hire = parseDateKey(job.hireDate || '');
    if (!hire) return;
    let end = today;
    if (job !== settings) {
      const jobEnd = parseDateKey(job.endDate || '');
      if (jobEnd && jobEnd < end) end = jobEnd;
    }
    if (hire > end) return;
    jobCount++;
    const stats = getJobWorkdayStats(job, end);
    workDays += stats.workDays;
    totalHours += stats.hours;
    totalEarned += stats.earned;
    if (!firstHire || hire < firstHire) firstHire = hire;
  });

  const tenureDays = firstHire ? Math.floor((today - firstHire) / 86400000) + 1 : 0;
  return {
    hireDate: settings.hireDate || '',
    firstHireDate: firstHire ? fmtDateKey(firstHire) : '',
    workDays, totalHours, totalEarned,
    lifeDays: totalHours / 24,
    tenureDays,
    jobCount
  };
}

function updateLifePanel() {
  const panel = document.getElementById('lifePanel');
  if (!panel) return;

  const stats = getLifeStats();
  if (stats.workDays <= 0) {
    panel.innerHTML = '<div class="life-empty">去「设置」页填上入职日期（或补一段历史工作），看看这些年你把多少生命换成了工资。</div>';
    return;
  }

  const { workDays, totalHours, totalEarned, lifeDays, tenureDays, jobCount } = stats;
  panel.innerHTML = `
    <div class="life-hero">
      <div class="life-hours">${Math.round(totalHours).toLocaleString()}<span class="unit">小时</span></div>
      <div class="life-hours-label">累计卖给工位的时间</div>
    </div>
    <div class="life-grid">
      <div class="life-stat"><div class="v">${tenureDays.toLocaleString()}<small>天</small></div><div class="k">入职天数</div></div>
      <div class="life-stat"><div class="v">${workDays.toLocaleString()}<small>天</small></div><div class="k">打工天数</div></div>
      <div class="life-stat"><div class="v">${lifeDays.toFixed(1)}<small>天</small></div><div class="k">折合生命</div></div>
      <div class="life-stat"><div class="v">${fmtMoneyCompact(totalEarned)}</div><div class="k">已换工资</div></div>
    </div>
    ${jobCount > 1 ? `<div class="life-note">已累计 ${jobCount} 段工作经历</div>` : ''}
  `;
}

// ============ 反向计算器 ============
function selectCalcMode(mode) {
  calcMode = mode;
  document.querySelectorAll('#calcMode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const label = document.getElementById('calcInputLabel');
  const input = document.getElementById('calcInput');
  if (mode === 'goal') {
    if (label) label.textContent = '想赚多少钱 (¥)';
    if (input) { input.step = '10'; input.placeholder = '500'; }
  } else {
    if (label) label.textContent = '想摸鱼多少小时';
    if (input) { input.step = '0.5'; input.placeholder = '1'; }
  }
  updateCalculator();
}

function fmtHours(h) {
  if (h <= 0) return '0 小时';
  if (h < 1) return Math.round(h * 60) + ' 分钟';
  if (h < 100) return h.toFixed(1) + ' 小时';
  return Math.round(h).toLocaleString() + ' 小时';
}

function updateCalculator() {
  const input = document.getElementById('calcInput');
  const valueEl = document.getElementById('calcResultValue');
  if (!input || !valueEl) return;

  const raw = parseFloat(input.value);
  const val = isNaN(raw) || raw < 0 ? 0 : raw;
  const hourlyRate = getHourlyRate();
  const dailyHours = getDailyHours();
  const labelEl = document.getElementById('calcResultLabel');
  const noteEl = document.getElementById('calcResultNote');

  if (hourlyRate <= 0) {
    valueEl.textContent = '—';
    labelEl.textContent = '';
    noteEl.textContent = '先去设置里填上你的月薪，这笔账才算得清';
    return;
  }

  if (calcMode === 'goal') {
    const hours = val / hourlyRate;
    valueEl.textContent = fmtHours(hours);
    labelEl.textContent = '需要熬的工时';
    if (val <= 0) {
      noteEl.textContent = '输入想赚的金额，看看要熬多久才能换到';
    } else if (dailyHours > 0) {
      noteEl.textContent = `按每天 ${dailyHours.toFixed(1)} 小时算，约 ${(hours / dailyHours).toFixed(1)} 个工作日。慢走，不送。`;
    } else {
      noteEl.textContent = '';
    }
  } else {
    const money = val * hourlyRate;
    valueEl.textContent = formatMoney(money);
    labelEl.textContent = '白拿工资';
    noteEl.textContent = val > 0
      ? `摸鱼 ${fmtHours(val)}，钱一分不少地到账 —— 这是你应得的。`
      : '输入摸鱼小时数，看看能白拿多少';
  }
}

// ============ 记账 ============
// 默认项目固定内置，自定义项目单独持久化；记录里保存项目快照，后续改项目不影响历史
const LEDGER_DEFAULT_CATEGORIES = [
  { id: 'food',      name: '餐饮', icon: '🍚' },
  { id: 'transport', name: '交通', icon: '🚌' },
  // utilities 沿用旧「水电」的 id，保证历史记录修改时仍能对应到项目
  { id: 'utilities', name: '水费', icon: '💧' },
  { id: 'electricity', name: '电费', icon: '💡' },
  { id: 'gas',       name: '燃气', icon: '🔥' },
  { id: 'heating',   name: '取暖', icon: '♨️' },
  { id: 'rent',      name: '租房', icon: '🏠' },
  { id: 'gift',      name: '礼金', icon: '🎁' },
  { id: 'shopping',  name: '购物', icon: '🛍️' },
  { id: 'fun',       name: '娱乐', icon: '🎮' },
  { id: 'medical',   name: '医疗', icon: '💊' },
  { id: 'insurance', name: '保险', icon: '🛡️' },
  { id: 'phone',     name: '通讯', icon: '📱' },
  { id: 'study',     name: '学习', icon: '📚' },
  { id: 'other',     name: '其他', icon: '📦' }
];
const LEDGER_ICON_OPTIONS = [
  '🏷️',
  '🍚','🍜','🍔','🍕','🍱','🥗','🍰','🍎','🧋','☕','🍺',
  '🚌','🚇','🚕','🚗','🚲','🛵','✈️','⛽',
  '🏠','💡','💧','🔧','🛋️','🚿',
  '🛍️','🛒','👕','👗','👟','💄','👜',
  '🎮','🎬','🎤','🎧','🎲','⚽','🎸',
  '💊','🏥','🩺','🧘',
  '📱','💻','📚','✏️','🎓',
  '🐱','🐶','🐟','🐦',
  '🎁','🎂','🎉','💳','🧾','📦'
];

function getLedgerCategories() {
  return LEDGER_DEFAULT_CATEGORIES.concat(ledgerCategories);
}

function ledgerCategoryById(id) {
  return getLedgerCategories().find(c => c.id === id) || null;
}

function saveLedgerRecords() {
  localStorage.setItem('qianxwk_ledger_records', JSON.stringify(ledgerRecords));
}

function saveLedgerCategories() {
  localStorage.setItem('qianxwk_ledger_categories', JSON.stringify(ledgerCategories));
}

function ledgerMonthRecords(month) {
  return ledgerRecords.filter(r => r && typeof r.date === 'string' && r.date.slice(0, 7) === month);
}

function ledgerTotal(records) {
  return records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

function escapeLedgerText(text) {
  return String(text == null ? '' : text).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function ledgerDateLabel(key) {
  const d = parseDateKey(key);
  if (!d) return key;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${formatDateSlash(key)} · ${weekdays[d.getDay()]}`;
}

// 金额 -> 折算工作日所需的秒数；未配置有效时薪时返回 null
function ledgerWorkSeconds(amount) {
  const rate = getHourlyRate();
  if (!(rate > 0)) return null;
  return Math.max(0, Number(amount) || 0) / rate * 3600;
}

// 统一展示为 秒 / 分钟 / 小时 / 天，1 天按一个工作日的收入折算
function formatLedgerWork(seconds) {
  if (seconds === null || !isFinite(seconds)) return '—';
  if (seconds <= 0) return '0 秒';
  if (seconds < 60) return Math.max(1, Math.round(seconds)) + ' 秒';
  if (seconds < 3600) return Math.round(seconds / 60) + ' 分钟';
  const dailySeconds = getPaidDailyHours() * 3600;
  if (!(dailySeconds > 0)) {
    const fallback = seconds / 86400;
    return (fallback < 10 ? fallback.toFixed(1) : Math.round(fallback)) + ' 天';
  }
  if (seconds < dailySeconds) {
    const h = seconds / 3600;
    return (h < 10 ? h.toFixed(1) : Math.round(h)) + ' 小时';
  }
  const d = seconds / dailySeconds;
  return (d < 10 ? d.toFixed(1) : Math.round(d)) + ' 天';
}

function formatLedgerCompactMoney(value) {
  const n = Number(value) || 0;
  if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '万';
  if (n >= 1000) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

// ---------- 页面渲染 ----------
function renderLedger() {
  if (!ledgerMonth) ledgerMonth = currentMonthKey();
  const todayKey = fmtDateKey(new Date());
  if (!ledgerViewDate || ledgerViewDate.slice(0, 7) !== ledgerMonth) {
    ledgerViewDate = todayKey.slice(0, 7) === ledgerMonth ? todayKey : `${ledgerMonth}-01`;
  }
  renderLedgerCalendar();
  renderLedgerSummary();
  renderLedgerRecordList();
  renderLedgerStats();
}

function renderLedgerCalendar() {
  const grid = document.getElementById('ledgerCalendarGrid');
  if (!grid) return;
  const [y, m] = ledgerMonth.split('-').map(Number);
  const label = `${y} 年 ${m} 月`;
  const statsLabel = ledgerStatsScope === 'year'
    ? (m > 1 ? `${y} 年 1-${m} 月` : `${y} 年 1 月`)
    : label;
  const monthLabelEl = document.getElementById('ledgerMonthLabel');
  if (monthLabelEl) monthLabelEl.textContent = label;
  const statsLabelEl = document.getElementById('ledgerStatsMonthLabel');
  if (statsLabelEl) statsLabelEl.textContent = statsLabel;

  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 周一排第一列
  const days = new Date(y, m, 0).getDate();
  const todayKey = fmtDateKey(new Date());
  const dailyTotals = {};
  ledgerMonthRecords(ledgerMonth).forEach(r => {
    dailyTotals[r.date] = (dailyTotals[r.date] || 0) + (Number(r.amount) || 0);
  });

  let html = '';
  for (let i = 0; i < offset; i++) html += '<span class="ledger-day empty"></span>';
  for (let day = 1; day <= days; day++) {
    const key = `${ledgerMonth}-${String(day).padStart(2, '0')}`;
    const total = dailyTotals[key] || 0;
    const cls = ['ledger-day'];
    if (key === todayKey) cls.push('today');
    if (total > 0) cls.push('has-record');
    if (key === ledgerViewDate) cls.push('selected');
    html += `<button type="button" class="${cls.join(' ')}" onclick="selectLedgerDate('${key}')">
      <span class="l-day-num">${day}</span>
      ${total > 0 ? `<span class="l-day-amount">¥${formatLedgerCompactMoney(total)}</span>` : ''}
    </button>`;
  }
  grid.innerHTML = html;
}

function renderLedgerSummary() {
  const records = ledgerMonthRecords(ledgerMonth);
  const total = ledgerTotal(records);
  const totalEl = document.getElementById('ledgerMonthTotal');
  const timeEl = document.getElementById('ledgerMonthTime');
  const countEl = document.getElementById('ledgerMonthCount');
  if (totalEl) totalEl.textContent = formatMoney(total);
  if (timeEl) timeEl.textContent = formatLedgerWork(ledgerWorkSeconds(total));
  if (countEl) countEl.textContent = records.length + ' 笔';
}

function renderLedgerRecordList() {
  const box = document.getElementById('ledgerMonthRecords');
  if (!box) return;
  const title = document.getElementById('ledgerListTitle');
  if (title) title.textContent = ledgerDateLabel(ledgerViewDate);
  const records = ledgerRecords.filter(r => r.date === ledgerViewDate)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!records.length) {
    box.innerHTML = '<div class="ledger-empty-hint">这一天还没有记录，点击下方按钮记一笔</div>';
    return;
  }
  box.innerHTML = records.map(r => {
    const note = r.note ? ' · ' + escapeLedgerText(r.note) : '';
    const work = formatLedgerWork(ledgerWorkSeconds(r.amount));
    return `<div class="ledger-record" role="button" tabindex="0" onclick="openLedgerEditModal('${r.id}')">
      <span class="ledger-record-icon">${escapeLedgerText(r.icon || '📦')}</span>
      <span class="ledger-record-info">
        <span class="ledger-record-name">${escapeLedgerText(r.name)}${note}</span>
        <span class="ledger-record-meta">折算工作日 ${work}</span>
      </span>
      <span class="ledger-record-amount">${formatMoney(Number(r.amount) || 0)}</span>
      <button type="button" class="ledger-del" title="删除" onclick="event.stopPropagation(); deleteLedgerRecord('${r.id}')">×</button>
    </div>`;
  }).join('');
}

// 年度累计已赚：与统计页「年度概览」同口径，逐日按所属工作（含历史工作）折算，
// 截至所选月份月末；超过今天时按今天实时收益截止，未来月份不额外增加
function getYearEarnedThroughMonth(year, endMonth, grossOnly) {
  const now = new Date();
  const shiftAnchor = getShiftAnchorDate(now);
  const todayKey = fmtDateKey(shiftAnchor);
  const monthEnd = new Date(year, endMonth, 0);
  const cutoff = monthEnd < shiftAnchor ? monthEnd : shiftAnchor;
  const includeToday = cutoff.getTime() === shiftAnchor.getTime()
    && shiftAnchor.getFullYear() === year;

  const cache = new Map();
  let earned = 0;
  for (let d = new Date(year, 0, 1); d <= cutoff && d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const job = jobOnDate(d);
    if (!job || !isWorkdayByConfig(d, job)) continue;
    // 今天单独按实时收益累计，避免重复计入整天
    if (includeToday && fmtDateKey(d) === todayKey) continue;
    earned += jobDailyPay(job, d, grossOnly, cache);
  }

  // 今天：当前工作按实时工时，历史工作（如刚归档当天）按整天
  if (includeToday) {
    const liveJob = jobOnDate(shiftAnchor);
    if (liveJob === settings) {
      const state = getCurrentWorkState();
      if (!state.isRest) {
        earned += grossOnly
          ? state.workedMinutes * getGrossHourlyRate() / 60
          : state.earnedToday;
      }
    } else if (liveJob && isWorkdayByConfig(shiftAnchor, liveJob)) {
      earned += jobDailyPay(liveJob, shiftAnchor, grossOnly, cache);
    }
  }

  const overtimeMatch = d => d.getFullYear() === year && d.getMonth() + 1 <= endMonth;
  earned += linkedOvertime(overtimeMatch, undefined, grossOnly);
  return earned;
}

// 记账图表的收入：年度看 1 月至所选月份的累计，月度看所选月份本身；
// 都按今天已实时累计的收益计算，与计时页一样每秒增长
function getLedgerStatsIncome(year, month, isYear) {
  const throughMonth = getYearEarnedThroughMonth(year, month);
  if (isYear) return throughMonth;
  return throughMonth - getYearEarnedThroughMonth(year, month - 1);
}

// 本月已赚：逐日按试用期 / 正式期时薪拆分，首页、统计页与记账图表共用同一口径
function getCurrentMonthEarned(grossOnly) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return getYearEarnedThroughMonth(year, month, grossOnly)
    - getYearEarnedThroughMonth(year, month - 1, grossOnly);
}

// 统计区间内的记账记录：年度为 1 月至所选月份累计
function ledgerStatsRecords(year, month, isYear) {
  const startMonth = isYear ? 1 : month;
  return ledgerRecords.filter(r => {
    if (!r || typeof r.date !== 'string') return false;
    const [ry, rm] = r.date.split('-').map(Number);
    return ry === year && rm >= startMonth && rm <= month;
  });
}

function renderLedgerStats() {
  const totalEl = document.getElementById('ledgerStatsTotal');
  if (!totalEl) return;
  const [y, m] = ledgerMonth.split('-').map(Number);
  const isYear = ledgerStatsScope === 'year';
  // 年度统计为累计口径：1 月只看 1 月，2 月看 1-2 月
  const startMonth = isYear ? 1 : m;
  const records = ledgerStatsRecords(y, m, isYear);
  const total = ledgerTotal(records);
  const seconds = ledgerWorkSeconds(total);
  const daysWithRecords = new Set(records.map(r => r.date)).size;

  // 统计区间天数；收入与计时页一致，按实时已赚每秒累计
  let daysInScope = 0;
  for (let i = startMonth; i <= m; i++) daysInScope += new Date(y, i, 0).getDate();
  const salary = getLedgerStatsIncome(y, m, isYear);
  const remaining = salary - total;

  document.getElementById('ledgerStatsTitle').textContent = isYear ? '年度支出' : '本月支出';
  totalEl.textContent = formatMoney(total);
  document.getElementById('ledgerStatsTime').textContent = seconds === null
    ? '按当前时薪折算：先在「设置」里填好月薪'
    : `折算工作日 ${formatLedgerWork(seconds)} · 按当前时薪折算`;
  document.getElementById('ledgerStatsSalaryLabel').textContent = isYear ? '累计已赚' : '本月已赚';
  document.getElementById('ledgerStatsSalary').textContent = formatMoney(salary);
  const remainingEl = document.getElementById('ledgerStatsRemaining');
  remainingEl.textContent = (remaining < 0 ? '-¥' : '¥') + Math.abs(remaining).toFixed(2);
  remainingEl.classList.toggle('negative', remaining < 0);
  document.getElementById('ledgerStatsAvg').textContent = formatMoney(total / daysInScope);
  document.getElementById('ledgerStatsDays').textContent = daysWithRecords + ' 天';
  document.getElementById('ledgerStatsCountLabel').textContent = isYear ? '年度笔数' : '本月笔数';
  document.getElementById('ledgerStatsCount').textContent = records.length + ' 笔';
  document.getElementById('ledgerStatsFree').textContent = (daysInScope - daysWithRecords) + ' 天';

  // 分类占比
  const catBox = document.getElementById('ledgerCategoryList');
  const catMap = {};
  records.forEach(r => {
    const name = r.name || '其他';
    if (!catMap[name]) catMap[name] = { name, icon: r.icon || '📦', total: 0 };
    catMap[name].total += Number(r.amount) || 0;
  });
  const cats = Object.values(catMap).sort((a, b) => b.total - a.total);
  catBox.innerHTML = cats.length ? cats.map(c => {
    const pct = total > 0 ? c.total / total * 100 : 0;
    return `<div class="ledger-cat-row">
      <div class="ledger-cat-head">
        <span class="ledger-cat-name">${escapeLedgerText(c.icon)} ${escapeLedgerText(c.name)}</span>
        <span class="ledger-cat-val">${formatMoney(c.total)} · ${pct.toFixed(0)}%</span>
      </div>
      <div class="ledger-cat-bar"><div class="ledger-cat-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </div>`;
  }).join('') : `<div class="ledger-empty-hint">${isYear ? '年度' : '本月'}还没有支出分类</div>`;

  // 支出趋势：月度看每日，年度看每月
  const barsEl = document.getElementById('ledgerTrendBars');
  const axisEl = document.getElementById('ledgerTrendAxis');
  document.getElementById('ledgerTrendTitle').textContent = isYear ? '每月支出' : '每日支出';
  if (isYear) {
    const monthly = new Array(m + 1).fill(0);
    records.forEach(r => {
      const mm = parseInt(r.date.slice(5, 7), 10);
      if (mm >= startMonth && mm <= m) monthly[mm] += Number(r.amount) || 0;
    });
    const maxMonth = Math.max(...monthly.slice(startMonth), 0);
    barsEl.innerHTML = monthly.slice(startMonth).map((v, i) => {
      const h = maxMonth > 0 ? v / maxMonth * 100 : 0;
      const cls = 'ledger-trend-bar' + (v > 0 ? ' has' : '') + (v === maxMonth && v > 0 ? ' max' : '');
      return `<div class="${cls}" style="height:${h}%" title="${startMonth + i} 月 ${formatMoney(v)}"></div>`;
    }).join('');
    axisEl.innerHTML = monthly.slice(startMonth)
      .map((_, i) => `<span>${startMonth + i}</span>`).join('');
  } else {
    const daysInMonth = new Date(y, m, 0).getDate();
    const daily = new Array(daysInMonth + 1).fill(0);
    records.forEach(r => {
      const day = parseInt(r.date.slice(8, 10), 10);
      if (day >= 1 && day <= daysInMonth) daily[day] += Number(r.amount) || 0;
    });
    const max = Math.max(...daily.slice(1), 0);
    barsEl.innerHTML = daily.slice(1).map((v, i) => {
      const h = max > 0 ? v / max * 100 : 0;
      const cls = 'ledger-trend-bar' + (v > 0 ? ' has' : '') + (v === max && v > 0 ? ' max' : '');
      return `<div class="${cls}" style="height:${h}%" title="${y}/${String(m).padStart(2, '0')}/${String(i + 1).padStart(2, '0')} ${formatMoney(v)}"></div>`;
    }).join('');
    axisEl.innerHTML = [...new Set([1, 5, 10, 15, 20, 25, daysInMonth])]
      .filter(d => d <= daysInMonth).map(d => `<span>${d}</span>`).join('');
  }

  // 本月之最 / 年度之最
  document.getElementById('ledgerTopTitle').textContent = isYear ? '年度之最' : '本月之最';
  const topBox = document.getElementById('ledgerTopList');
  if (!records.length) {
    topBox.innerHTML = `<div class="ledger-empty-hint">${isYear ? '年度' : '本月'}还没有记录，记账后会显示${isYear ? '年度' : '本月'}之最</div>`;
    return;
  }
  const maxRecord = records.reduce((a, b) => (Number(b.amount) || 0) > (Number(a.amount) || 0) ? b : a);
  const catCounts = {};
  records.forEach(r => { const name = r.name || '其他'; catCounts[name] = (catCounts[name] || 0) + 1; });
  const topCatName = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a])[0];
  const topCatIcon = (records.find(r => (r.name || '其他') === topCatName) || {}).icon || '📦';
  const freeDays = daysInScope - daysWithRecords;
  topBox.innerHTML = `
    <div class="ledger-top-row">
      <span class="lbl">最贵的一笔</span>
      <span class="val">${escapeLedgerText(maxRecord.icon || '📦')} ${escapeLedgerText(maxRecord.name)} ${formatMoney(Number(maxRecord.amount) || 0)}
        <em>折算工作日 ${formatLedgerWork(ledgerWorkSeconds(maxRecord.amount))}</em></span>
    </div>
    <div class="ledger-top-row">
      <span class="lbl">最常记</span>
      <span class="val">${escapeLedgerText(topCatIcon)} ${escapeLedgerText(topCatName)}
        <em>${catCounts[topCatName]} 笔</em></span>
    </div>
    <div class="ledger-top-row">
      <span class="lbl">记账覆盖</span>
      <span class="val">${daysWithRecords} / ${daysInScope} 天
        <em>无消费 ${freeDays} 天</em></span>
    </div>`;
}

// 记账图表收入每秒刷新：只更新会随秒变化的收入与剩余工资，避免整块重绘
function refreshLedgerStatsIncome() {
  const panel = document.querySelector('#screen-ledger .ledger-panel[data-tab="stats"]');
  if (!panel || !panel.classList.contains('active')) return;
  const salaryEl = document.getElementById('ledgerStatsSalary');
  const remainingEl = document.getElementById('ledgerStatsRemaining');
  if (!salaryEl || !remainingEl || !ledgerMonth) return;

  const [y, m] = ledgerMonth.split('-').map(Number);
  const isYear = ledgerStatsScope === 'year';
  const total = ledgerTotal(ledgerStatsRecords(y, m, isYear));
  const salary = getLedgerStatsIncome(y, m, isYear);
  const remaining = salary - total;

  salaryEl.textContent = formatMoney(salary);
  remainingEl.textContent = (remaining < 0 ? '-¥' : '¥') + Math.abs(remaining).toFixed(2);
  remainingEl.classList.toggle('negative', remaining < 0);
}

// ---------- 标签页与月份 ----------
function selectLedgerTab(tab) {
  document.querySelectorAll('#ledgerTabs .ledger-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('#screen-ledger .ledger-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.tab === tab);
  });
  renderLedger();
}

// 图表范围切换：月度 / 年度累计
function selectLedgerScope(scope) {
  ledgerStatsScope = scope === 'year' ? 'year' : 'month';
  document.querySelectorAll('#ledgerScopeTabs .ledger-scope-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scope === ledgerStatsScope);
  });
  renderLedgerCalendar();
  renderLedgerStats();
}

function shiftLedgerMonth(delta) {
  if (!ledgerMonth) ledgerMonth = currentMonthKey();
  const [y, m] = ledgerMonth.split('-').map(Number);
  ledgerMonth = monthKeyOf(new Date(y, m - 1 + delta, 1));
  const todayKey = fmtDateKey(new Date());
  ledgerViewDate = todayKey.slice(0, 7) === ledgerMonth ? todayKey : `${ledgerMonth}-01`;
  renderLedger();
}

// 直接跳到指定月份（YYYY-MM）
function jumpLedgerMonth(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return;
  ledgerMonth = monthKey;
  const todayKey = fmtDateKey(new Date());
  ledgerViewDate = todayKey.slice(0, 7) === ledgerMonth ? todayKey : `${ledgerMonth}-01`;
  renderLedger();
}

// ---------- 月份快速选择 ----------
function openLedgerMonthPicker() {
  ledgerPickerYear = (ledgerMonth || currentMonthKey()).split('-').map(Number)[0];
  renderLedgerMonthPicker();
  const overlay = document.getElementById('ledgerMonthModal');
  overlay.classList.add('show');
  overlay.scrollTop = 0;
}

function closeLedgerMonthModal() {
  const overlay = document.getElementById('ledgerMonthModal');
  if (overlay) overlay.classList.remove('show');
}

function shiftLedgerPickerYear(delta) {
  ledgerPickerYear += delta;
  renderLedgerMonthPicker();
}

function renderLedgerMonthPicker() {
  const yearEl = document.getElementById('ledgerPickerYear');
  const gridEl = document.getElementById('ledgerPickerMonths');
  if (!yearEl || !gridEl) return;
  yearEl.textContent = ledgerPickerYear + ' 年';
  const current = currentMonthKey();
  let html = '';
  for (let m = 1; m <= 12; m++) {
    const key = `${ledgerPickerYear}-${String(m).padStart(2, '0')}`;
    const cls = ['month-picker-item'];
    if (key === ledgerMonth) cls.push('active');
    if (key === current) cls.push('today');
    html += `<button type="button" class="${cls.join(' ')}" onclick="pickLedgerMonth('${key}')">${m} 月</button>`;
  }
  gridEl.innerHTML = html;
}

function pickLedgerMonth(monthKey) {
  closeLedgerMonthModal();
  jumpLedgerMonth(monthKey);
}

// ---------- 记账弹窗 ----------
function selectLedgerDate(dateKey) {
  ledgerViewDate = dateKey;
  renderLedgerCalendar();
  renderLedgerRecordList();
}

function openLedgerForSelectedDate() {
  if (ledgerViewDate) openLedgerModal(ledgerViewDate);
}

function openLedgerModal(dateKey) {
  ledgerEditingId = null;
  ledgerDate = dateKey;
  ledgerViewDate = dateKey;
  const cats = getLedgerCategories();
  if (!cats.some(c => c.id === ledgerSelectedCategory)) {
    ledgerSelectedCategory = cats[0] ? cats[0].id : '';
  }
  const title = document.getElementById('ledgerModalTitle');
  if (title) title.textContent = ledgerDateLabel(dateKey);
  document.getElementById('ledgerSubmitBtn').textContent = '记账';
  document.getElementById('ledgerAmount').value = '';
  document.getElementById('ledgerNote').value = '';
  closeLedgerCustomForm();
  renderLedgerCategories();
  renderLedgerCalendar();
  renderLedgerRecordList();
  updateLedgerWorkPreview();
  const overlay = document.getElementById('ledgerModal');
  overlay.classList.add('show');
  overlay.scrollTop = 0;
  setTimeout(() => {
    const input = document.getElementById('ledgerAmount');
    if (input && document.getElementById('ledgerModal').classList.contains('show')) input.focus();
  }, 60);
}

function openLedgerEditModal(recordId) {
  const record = ledgerRecords.find(r => r.id === recordId);
  if (!record) return;
  ledgerEditingId = recordId;
  ledgerDate = record.date;
  ledgerViewDate = record.date;
  ledgerSelectedCategory = record.categoryId;
  const cats = getLedgerCategories();
  if (!cats.some(c => c.id === ledgerSelectedCategory)) {
    const byName = cats.find(c => c.name === record.name);
    ledgerSelectedCategory = byName ? byName.id : (cats[0] ? cats[0].id : '');
  }
  const title = document.getElementById('ledgerModalTitle');
  if (title) title.textContent = '修改记录 · ' + ledgerDateLabel(record.date);
  document.getElementById('ledgerSubmitBtn').textContent = '保存修改';
  document.getElementById('ledgerAmount').value = record.amount;
  document.getElementById('ledgerNote').value = record.note || '';
  closeLedgerCustomForm();
  renderLedgerCategories();
  renderLedgerCalendar();
  renderLedgerRecordList();
  updateLedgerWorkPreview();
  const overlay = document.getElementById('ledgerModal');
  overlay.classList.add('show');
  overlay.scrollTop = 0;
  setTimeout(() => {
    const input = document.getElementById('ledgerAmount');
    if (input) { input.focus(); input.select(); }
  }, 60);
}

function closeLedgerModal() {
  const overlay = document.getElementById('ledgerModal');
  if (overlay) overlay.classList.remove('show');
  ledgerDate = '';
  ledgerEditingId = null;
  document.getElementById('ledgerAmount').value = '';
  document.getElementById('ledgerNote').value = '';
  document.getElementById('ledgerSubmitBtn').textContent = '记账';
  closeLedgerCustomForm();
  updateLedgerWorkPreview();
}

function renderLedgerCategories() {
  const box = document.getElementById('ledgerCats');
  const customBox = document.getElementById('ledgerCustomCats');
  if (!box || !customBox) return;

  box.innerHTML = LEDGER_DEFAULT_CATEGORIES.map(c => `
    <button type="button" class="ledger-cat${c.id === ledgerSelectedCategory ? ' active' : ''}" onclick="selectLedgerCategory('${c.id}')">
      <span>${escapeLedgerText(c.icon)}</span>${escapeLedgerText(c.name)}
    </button>`).join('');

  customBox.innerHTML = ledgerCategories.map(c => `
    <span class="ledger-custom-pair">
      <button type="button" class="ledger-cat${c.id === ledgerSelectedCategory ? ' active' : ''}" onclick="selectLedgerCategory('${c.id}')">
        <span>${escapeLedgerText(c.icon)}</span>${escapeLedgerText(c.name)}
      </button>
      <button type="button" class="ledger-cat-del" title="删除项目" onclick="deleteLedgerCategory('${c.id}')">×</button>
    </span>`).join('')
    + '<button type="button" class="ledger-cat ledger-cat-add" onclick="openLedgerCustomForm()">＋ 自定义</button>';
}

function deleteLedgerCategory(id) {
  const cat = ledgerCategories.find(c => c.id === id);
  if (!cat) return;
  if (!confirm(`确定删除自定义项目「${cat.name}」吗？删除后无法恢复，已记账的记录不受影响。`)) return;
  ledgerCategories = ledgerCategories.filter(c => c.id !== id);
  saveLedgerCategories();
  if (ledgerSelectedCategory === id) ledgerSelectedCategory = 'other';
  renderLedgerCategories();
  showToast('已删除项目：' + cat.name);
}

function selectLedgerCategory(id) {
  ledgerSelectedCategory = id;
  renderLedgerCategories();
}

function openLedgerCustomForm() {
  const form = document.getElementById('ledgerCustomForm');
  if (!form) return;
  form.style.display = 'block';
  document.getElementById('ledgerCustomName').value = '';
  ledgerCustomIcon = '🏷️';
  renderLedgerIconOptions();
  document.getElementById('ledgerCustomName').focus();
}

function closeLedgerCustomForm() {
  const form = document.getElementById('ledgerCustomForm');
  if (form) form.style.display = 'none';
  const input = document.getElementById('ledgerCustomName');
  if (input) input.value = '';
}

function renderLedgerIconOptions() {
  const box = document.getElementById('ledgerIconOptions');
  if (!box) return;
  box.innerHTML = LEDGER_ICON_OPTIONS.map(icon => `
    <button type="button" class="ledger-icon-option${icon === ledgerCustomIcon ? ' active' : ''}" onclick="selectLedgerCustomIcon('${icon}')">${icon}</button>`).join('');
}

function selectLedgerCustomIcon(icon) {
  ledgerCustomIcon = icon;
  renderLedgerIconOptions();
}

function addLedgerCategory() {
  const name = document.getElementById('ledgerCustomName').value.trim();
  if (!name) {
    showToast('请输入项目名称');
    return;
  }
  if (getLedgerCategories().some(c => c.name === name)) {
    showToast('这个项目已经有了');
    return;
  }
  const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  ledgerCategories.push({ id, name, icon: ledgerCustomIcon || '🏷️' });
  saveLedgerCategories();
  ledgerSelectedCategory = id;
  closeLedgerCustomForm();
  renderLedgerCategories();
  showToast('已添加项目：' + name);
}

function submitLedgerRecord() {
  if (!ledgerDate) return;
  const cat = ledgerCategoryById(ledgerSelectedCategory);
  const amount = parseFloat(document.getElementById('ledgerAmount').value);
  if (!cat) {
    showToast('请选择记账项目');
    return;
  }
  if (!(amount > 0)) {
    showToast('请输入有效金额');
    return;
  }
  const note = document.getElementById('ledgerNote').value.trim();
  const rounded = Math.round(amount * 100) / 100;

  if (ledgerEditingId) {
    const idx = ledgerRecords.findIndex(r => r.id === ledgerEditingId);
    if (idx !== -1) {
      ledgerRecords[idx] = {
        ...ledgerRecords[idx],
        categoryId: cat.id,
        name: cat.name,
        icon: cat.icon,
        amount: rounded,
        note
      };
    }
    saveLedgerRecords();
    closeLedgerModal();
    renderLedger();
    showToast('已保存修改');
    return;
  }

  ledgerRecords.push({
    id: 'lr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    date: ledgerDate,
    categoryId: cat.id,
    name: cat.name,
    icon: cat.icon,
    amount: rounded,
    note,
    createdAt: Date.now()
  });
  saveLedgerRecords();
  closeLedgerModal();
  renderLedger();
  showToast('已记账：' + formatMoney(amount));
}

function deleteLedgerRecord(id) {
  ledgerRecords = ledgerRecords.filter(r => r.id !== id);
  saveLedgerRecords();
  if (ledgerEditingId === id) closeLedgerModal();
  renderLedger();
  showToast('已删除这笔记录');
}

function updateLedgerWorkPreview() {
  const box = document.getElementById('ledgerWorkPreview');
  const input = document.getElementById('ledgerAmount');
  if (!box || !input) return;
  const amount = parseFloat(input.value);
  if (!(amount > 0)) {
    box.classList.remove('show');
    box.innerHTML = '';
    return;
  }
  const seconds = ledgerWorkSeconds(amount);
  box.classList.add('show');
  if (seconds === null) {
    box.innerHTML = '<span>先在「设置」里填好月薪，就能看到这笔钱折算成多少个工作日</span>';
    return;
  }
  box.innerHTML = `<span>这笔钱折算工作日 <strong>${formatLedgerWork(seconds)}</strong></span>
    <span class="ledger-work-precise">精确 ${Math.round(seconds).toLocaleString()} 秒</span>`;
}

// ============ 分享卡片 ============
// 用 Canvas 纯手绘分享图，不依赖第三方库，离线也能生成
const SHARE_FONT = '"PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';
const SHARE_MONO = '"SF Mono", "Consolas", monospace';
let shareCardBlob = null;
let shareCardUrl = '';
// 分享内容勾选：默认全部展示，取消勾选后对应模块不进入分享图
let shareSections = { countdown: true, salary: true, commute: true, overtime: true, ledger: true, life: true, year: true };
// 分享模块顺序：与勾选项一致，可长按拖动调整并保存在本地
const SHARE_ORDER_KEY = 'qianxwk_share_order';
const SHARE_SECTION_KEYS = ['countdown', 'salary', 'commute', 'overtime', 'ledger', 'life', 'year'];
let shareOrder = (() => {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(SHARE_ORDER_KEY)) || []; } catch (e) { saved = []; }
  const order = Array.isArray(saved) ? saved.filter(k => SHARE_SECTION_KEYS.includes(k)) : [];
  SHARE_SECTION_KEYS.forEach(k => { if (!order.includes(k)) order.push(k); });
  return order;
})();

function saveShareOrder() {
  try { localStorage.setItem(SHARE_ORDER_KEY, JSON.stringify(shareOrder)); } catch (e) { /* 写入失败不影响使用 */ }
}
let shareRenderToken = 0; // 连续勾选时只保留最后一次生成结果，避免预览图错位

function shareRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function shareCardName() {
  return 'qianxwk-' + fmtDateKey(new Date()) + '.png';
}

// 取值直接读计时页当前展示的文案，保证分享图与屏幕上一致
function getShareData() {
  updateTimer();
  updateStats(); // 年度概览等统计信息需要同步刷新后再取文案
  const txt = id => {
    const el = document.getElementById(id);
    return el ? (el.textContent || '').trim() : '';
  };
  const now = new Date();
  const todayKey = fmtDateKey(now);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const progressEl = document.getElementById('progressFill');

  // 加班：给钱口径看金额与时长，调休口径看剩余调休
  const otToday = sumOvertime(overtimeOnDay(todayKey));
  const otMonth = sumOvertime(overtimeInMonth(now.getFullYear(), now.getMonth()));
  const allOvertimeHours = overtimeRecords.reduce((sum, r) => sum + overtimeHours(r), 0);
  const leaveEarned = totalLeaveEarned();
  const leaveUsed = totalLeaveUsed();

  // 记账：本月支出与折算工作日、今日支出
  const monthRecords = ledgerMonthRecords(monthKeyOf(now));
  const todayRecords = ledgerRecords.filter(r => r && r.date === todayKey);
  const monthSpend = ledgerTotal(monthRecords);
  const spentSeconds = ledgerWorkSeconds(monthSpend);
  const ledgerDays = new Set(monthRecords.map(r => r.date)).size;

  // 通勤：去程 / 返程 / 每日合计
  const commute = getCommuteSplit();
  const mode = settings.salaryMode || DEFAULTS.salaryMode;

  // 生命消耗大盘
  const life = getLifeStats();

  return {
    taxTag: mode === 'gross' ? '税前' : '税后',
    // 对比口径：额外读取税前一行，分享图里与税后并列展示
    isCompare: mode === 'compare',
    earned: txt('earnedToday'),
    monthEarned: txt('homeMonthEarned'),
    monthDays: txt('homeMonthDays'),
    hourly: txt('hourlyRate'),
    preTaxEarned: txt('preTaxEarnedToday'),
    preTaxMonth: txt('preTaxMonthEarned'),
    preTaxHourly: txt('preTaxHourly'),
    lifeHas: life.workDays > 0,
    lifeJobs: life.jobCount,
    lifeHours: Math.round(life.totalHours),
    lifeTenure: life.tenureDays,
    lifeWorkDays: life.workDays,
    lifeDays: life.lifeDays,
    lifeEarned: life.totalEarned,
    yearEarned: txt('annualEarned'),
    yearDays: txt('annualDays'),
    yearProgress: txt('annualProgressVal'),
    yearRemain: txt('annualRemainVal'),
    yearSpend: txt('annualSpendVal'),
    countdown: txt('countdownDisplay'),
    countdownLabel: txt('countdownLabel'),
    status: txt('statusText'),
    range: txt('startTimeLabel') + ' — ' + txt('endTimeLabel'),
    progress: Math.min(100, Math.max(0, parseFloat(progressEl && progressEl.style.width) || 0)),
    date: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`,
    weekday: weekdays[now.getDay()],
    overtimeSettle: (settings.overtimeSettle || DEFAULTS.overtimeSettle) === 'leave' ? 'leave' : 'money',
    otTodayMoney: formatMoney(otToday.money),
    otTodayHours: otToday.hours,
    otMonthMoney: formatMoney(otMonth.money),
    otMonthHours: otMonth.hours,
    otAllHours: allOvertimeHours,
    otCount: overtimeRecords.length,
    leaveEarned,
    leaveUsed,
    spendMonth: formatMoney(monthSpend),
    spendAvg: formatMoney(ledgerDays ? monthSpend / ledgerDays : 0),
    spendWork: spentSeconds === null ? '—' : (monthSpend > 0 ? formatLedgerWork(spentSeconds) : '0'),
    spendToday: formatMoney(ledgerTotal(todayRecords)),
    ledgerCount: monthRecords.length,
    ledgerDays,
    commuteBefore: commute.before,
    commuteAfter: commute.after,
    commuteTotal: commute.total,
    commuteInHourly: !!settings.commuteInHourly,
    commuteMode: (settings.commuteInputMode || DEFAULTS.commuteInputMode) === 'split' ? '往返分开填写' : '一天合计'
  };
}

// 分享图里的分区统计卡：左侧标题、右上角说明、下方若干列
function drawShareStatCard(ctx, x, y, w, h, title, note, cols) {
  shareRoundRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = '#171717';
  ctx.fill();
  ctx.strokeStyle = '#262626';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = `600 28px ${SHARE_FONT}`;
  ctx.fillStyle = '#ddd';
  ctx.fillText(title, x + 32, y + 52);
  if (note) {
    ctx.textAlign = 'right';
    ctx.font = `400 22px ${SHARE_FONT}`;
    ctx.fillStyle = '#777';
    ctx.fillText(note, x + w - 32, y + 52);
    ctx.textAlign = 'left';
  }

  const inner = 32;
  const colW = (w - inner * 2) / cols.length;
  // 四列时收窄字号，避免长金额挤在一起
  const labelSize = cols.length >= 4 ? 20 : 22;
  const valueSize = cols.length >= 4 ? 30 : 34;
  cols.forEach((col, i) => {
    const cx = x + inner + i * colW;
    ctx.font = `400 ${labelSize}px ${SHARE_FONT}`;
    ctx.fillStyle = '#999';
    ctx.fillText(col.label, cx, y + h * 0.49);
    ctx.font = `700 ${valueSize}px ${SHARE_FONT}`;
    ctx.fillStyle = col.color || '#c8ff00';
    ctx.fillText(col.value, cx, y + h * 0.74);
    if (col.sub) {
      ctx.font = `400 20px ${SHARE_FONT}`;
      ctx.fillStyle = '#777';
      ctx.fillText(col.sub, cx, y + h * 0.895);
    }
  });
}

// 分享图里的口径胶囊：green=true 荧光绿、false 对照紫
function drawShareTaxTag(ctx, x, y, text, green) {
  const h = 38;
  ctx.font = `600 24px ${SHARE_FONT}`;
  const w = ctx.measureText(text).width + 28;
  shareRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = green ? 'rgba(200, 255, 0, .14)' : 'rgba(167, 139, 250, .16)';
  ctx.fill();
  ctx.strokeStyle = green ? 'rgba(200, 255, 0, .5)' : 'rgba(167, 139, 250, .6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = green ? '#c8ff00' : '#a78bfa';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h / 2 + 8);
  ctx.textAlign = 'left';
  return w;
}

// 分享图里的薪资卡：与计时页卡片同构，右上角口径标注 + 金额 + 辅助行
function drawShareSalaryCard(ctx, x, y, w, h, card) {
  const themes = {
    // 主色主题：今日已赚用荧光绿底，本月已赚用黑底描主色边
    green: { bg: '#c8ff00', border: null, text: '#000', label: 'rgba(0, 0, 0, .7)', note: '#000', sub: 'rgba(0, 0, 0, .6)' },
    net: { bg: '#1e1e1e', border: 'rgba(200, 255, 0, .35)', text: '#fff', label: '#999', note: '#fff', sub: '#888' },
    // 对照主题：税后两卡用紫色底 / 黑底描紫边
    compare: { bg: '#1e1830', border: '#463469', text: '#fff', label: 'rgba(255, 255, 255, .7)', note: '#a78bfa', sub: 'rgba(255, 255, 255, .55)' },
    flat: { bg: '#1e1e1e', border: 'rgba(167, 139, 250, .35)', text: '#fff', label: 'rgba(255, 255, 255, .7)', note: '#fff', sub: 'rgba(255, 255, 255, .55)' }
  };
  const t = themes[card.tone];

  shareRoundRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = t.bg;
  ctx.fill();
  if (t.border) {
    ctx.strokeStyle = t.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 口径标注放右上角，与计时页卡片一致
  if (card.tag) {
    ctx.font = `600 22px ${SHARE_FONT}`;
    ctx.fillStyle = card.tagColor || t.note;
    ctx.textAlign = 'right';
    ctx.fillText(card.tag, x + w - 30, y + h * 0.25);
    ctx.textAlign = 'left';
  }

  ctx.font = `400 26px ${SHARE_FONT}`;
  ctx.fillStyle = t.label;
  ctx.fillText(card.label, x + 30, y + h * 0.33);

  // 金额过长时自动收窄字号，避免溢出卡片
  const maxW = w - 60;
  let size = 56;
  for (; size > 28; size -= 2) {
    ctx.font = `800 ${size}px ${SHARE_MONO}`;
    if (ctx.measureText(card.value).width <= maxW) break;
  }
  ctx.fillStyle = card.valueColor || t.text;
  ctx.fillText(card.value, x + 30, y + h * 0.67);

  if (card.sub) {
    ctx.font = `400 24px ${SHARE_FONT}`;
    ctx.fillStyle = t.sub;
    ctx.fillText(card.sub, x + 30, y + h * 0.88);
  }
}

// 对比口径的明细卡：沿用单一口径同款卡片，卡片内分税前（绿）/税后（紫）两行
function drawShareCompareCard(ctx, x, y, w, h, label, preTax, afterTax) {
  shareRoundRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = '#1e1e1e';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 255, 0, .35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `400 26px ${SHARE_FONT}`;
  ctx.fillStyle = '#999';
  ctx.fillText(label, x + 30, y + h * 0.28);

  [
    { tag: '税前', value: preTax || '¥0.00', color: '#c8ff00' },
    { tag: '税后', value: afterTax || '¥0.00', color: '#a78bfa' }
  ].forEach((row, i) => {
    const baseY = y + h * (i === 0 ? 0.6 : 0.88);
    ctx.font = `400 22px ${SHARE_FONT}`;
    const tagW = ctx.measureText(row.tag).width;
    ctx.fillStyle = row.color;
    ctx.fillText(row.tag, x + 30, baseY);

    // 金额过长时收窄字号，避免两行金额挤在一起
    let size = 32;
    const maxW = w - 60 - tagW - 14;
    for (; size > 22; size -= 2) {
      ctx.font = `700 ${size}px ${SHARE_MONO}`;
      if (ctx.measureText(row.value).width <= maxW) break;
    }
    ctx.fillStyle = row.color;
    ctx.fillText(row.value, x + 30 + tagW + 14, baseY);
  });
}

function drawShareCard() {
  const data = getShareData();
  const W = 1080, pad = 72;
  const accent = '#c8ff00', dim = '#999', faint = '#777';
  const sec = shareSections;
  const isCompare = !!data.isCompare;
  const salaryCardH = 176;
  // 对比口径：上方两行大字，下方两张明细卡与单一口径一致
  const compareRowH = 104;
  const salaryBlockH = isCompare
    ? 92 + 2 * compareRowH + 24 + salaryCardH
    : 182 + salaryCardH;
  const countdownLead = 40;
  const countdownBlockH = countdownLead + 124 + 50 + 66 + 76;
  const statCount = [sec.commute, sec.overtime, sec.ledger, sec.life, sec.year].filter(Boolean).length;
  const statGap = 22;
  const statH = statCount >= 5 ? 190 : (statCount === 4 ? 210 : 232);
  // 模块顺序由分享选项的拖动顺序决定，取消勾选后对应模块不占空间
  const visibleOrder = shareOrder.filter(key => sec[key]);
  const sectionHeight = key => key === 'countdown'
    ? countdownBlockH
    : (key === 'salary' ? salaryBlockH + 76 : statH + statGap);
  const contentBottom = 300 + visibleOrder.reduce((sum, key) => sum + sectionHeight(key), 0);
  const footerY = Math.max(1736, contentBottom + 30);
  const H = Math.max(1920, footerY + 184);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 背景与右上角光晕
  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 140, 40, 0, W - 140, 40, 780);
  glow.addColorStop(0, 'rgba(200, 255, 0, .13)');
  glow.addColorStop(1, 'rgba(200, 255, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 品牌与日期
  ctx.font = `800 58px ${SHARE_FONT}`;
  let bx = pad;
  ['千', '薪', '万苦'].forEach((ch, i) => {
    ctx.fillStyle = i === 1 ? accent : '#fff';
    ctx.fillText(ch, bx, 126);
    bx += ctx.measureText(ch).width;
  });
  // 状态徽章固定在右上角，不随模块勾选变化
  const statusText = data.status || '工作中';
  const statusTone = statusText === '工作中'
    ? { color: accent, bg: 'rgba(200, 255, 0, .10)', border: 'rgba(200, 255, 0, .35)' }
    : statusText === '通勤中'
      ? { color: '#4da3ff', bg: 'rgba(77, 163, 255, .10)', border: 'rgba(77, 163, 255, .35)' }
      : { color: '#ff6b6b', bg: 'rgba(255, 107, 107, .10)', border: 'rgba(255, 107, 107, .35)' };
  ctx.font = `600 26px ${SHARE_FONT}`;
  const badgeW = ctx.measureText(statusText).width + 66;
  const badgeX = W - pad - badgeW;
  const badgeY = 84;
  shareRoundRect(ctx, badgeX, badgeY, badgeW, 52, 26);
  ctx.fillStyle = statusTone.bg;
  ctx.fill();
  ctx.strokeStyle = statusTone.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = statusTone.color;
  ctx.beginPath();
  ctx.arc(badgeX + 26, badgeY + 26, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#999';
  ctx.fillText(statusText, badgeX + 44, badgeY + 35);

  // 日期排在徽章左侧
  ctx.font = `400 28px ${SHARE_FONT}`;
  ctx.fillStyle = faint;
  ctx.textAlign = 'right';
  ctx.fillText(`${data.date} ${data.weekday}`, badgeX - 16, 120);
  ctx.textAlign = 'left';

  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, 176);
  ctx.lineTo(W - pad, 176);
  ctx.stroke();

  // 按自定义顺序纵向排布各模块
  let cursor = 300;
  const statW = W - pad * 2;

  const drawCountdownBlock = y => {
    const countdownLabelY = y + countdownLead;
    ctx.font = `400 30px ${SHARE_FONT}`;
    ctx.fillStyle = dim;
    ctx.fillText(data.countdownLabel || '距离今天下班', pad, countdownLabelY);
    ctx.font = `400 28px ${SHARE_FONT}`;
    ctx.fillStyle = faint;
    ctx.textAlign = 'right';
    ctx.fillText(`今日进度 ${Math.round(data.progress)}%`, W - pad, countdownLabelY);
    ctx.textAlign = 'left';

    const countdownY = countdownLabelY + 124;
    const barY = countdownY + 50;
    const rangeY = barY + 66;

    ctx.font = `700 104px ${SHARE_MONO}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(data.countdown || '00:00:00', pad, countdownY);

    // 进度条
    const barH = 14;
    const barW = W - pad * 2;
    shareRoundRect(ctx, pad, barY, barW, barH, barH / 2);
    ctx.fillStyle = '#262626';
    ctx.fill();
    const fillW = barW * (data.progress / 100);
    if (fillW > 0) {
      shareRoundRect(ctx, pad, barY, Math.max(fillW, barH), barH, barH / 2);
      ctx.fillStyle = accent;
      ctx.fill();
    }

    ctx.font = `400 24px ${SHARE_FONT}`;
    ctx.fillStyle = faint;
    ctx.fillText(data.range, pad, rangeY);
    ctx.textAlign = 'right';
    ctx.fillText('每 1 秒都在到账', W - pad, rangeY);
    ctx.textAlign = 'left';
  };

  const drawSalaryBlock = salaryY => {
    ctx.font = `400 32px ${SHARE_FONT}`;
    ctx.fillStyle = dim;
    ctx.fillText('今日已赚', pad, salaryY + 40);
    if (!isCompare) {
      const labelW = ctx.measureText('今日已赚').width;
      // 单一口径下不区分对照色，徽章统一用荧光绿
      drawShareTaxTag(ctx, pad + labelW + 16, salaryY + 18, data.taxTag, true);
    }

    const cardGap = 24;
    const cardW = (W - pad * 2 - cardGap) / 2;

    if (isCompare) {
      // 上方两行大字：税前绿色、税后紫色
      [
        { tag: '税前', green: true, color: accent, value: data.preTaxEarned },
        { tag: '税后', green: false, color: '#a78bfa', value: data.earned }
      ].forEach((row, i) => {
        const top = salaryY + 92 + i * compareRowH;
        const tagW = drawShareTaxTag(ctx, pad, top + 34, row.tag, row.green);
        const value = row.value || '¥0.00';
        const maxW = W - pad * 2 - tagW - 20;
        let size = 84;
        for (; size > 48; size -= 4) {
          ctx.font = `800 ${size}px ${SHARE_MONO}`;
          if (ctx.measureText(value).width <= maxW) break;
        }
        ctx.fillStyle = row.color;
        ctx.fillText(value, pad + tagW + 20, top + 84);
      });

      // 下方两张明细卡与单一口径一致，卡片内分税前 / 税后两行
      const cardsTop = salaryY + 92 + 2 * compareRowH + 24;
      drawShareCompareCard(ctx, pad, cardsTop, cardW, salaryCardH, '本月已赚', data.preTaxMonth, data.monthEarned);
      drawShareCompareCard(ctx, pad + cardW + cardGap, cardsTop, cardW, salaryCardH, '时薪', data.preTaxHourly, data.hourly);
    } else {
      // 单一口径：今日已赚大字 + 本月已赚 / 时薪两张卡
      const value = (data.earned || '¥0.00').replace('¥', '');
      let heroSize = 128;
      for (; heroSize > 64; heroSize -= 4) {
        ctx.font = `800 ${heroSize}px ${SHARE_MONO}`;
        if (ctx.measureText(value).width <= W - pad * 2 - 52) break;
      }
      ctx.font = `600 54px ${SHARE_FONT}`;
      ctx.fillStyle = accent;
      ctx.fillText('¥', pad, salaryY + 150);
      ctx.font = `800 ${heroSize}px ${SHARE_MONO}`;
      ctx.fillText(value, pad + 52, salaryY + 150);

      const cardsTop = salaryY + 182;
      drawShareSalaryCard(ctx, pad, cardsTop, cardW, salaryCardH, {
        tone: 'net', label: '本月已赚', value: data.monthEarned || '¥0.00', sub: data.monthDays
      });
      drawShareSalaryCard(ctx, pad + cardW + cardGap, cardsTop, cardW, salaryCardH, {
        tone: 'net', label: '时薪', value: data.hourly, valueColor: accent
      });
    }
  };

  const hoursText = h => (h > 0 ? formatHours(h) : '0 小时');
  const commuteNote = data.commuteTotal <= 0
    ? '未设置通勤'
    : (data.commuteInHourly ? '已计入时薪' : '未计入时薪');
  const isLeave = data.overtimeSettle === 'leave';
  const lifeOn = data.lifeHas;
  const statCards = {
    commute: {
      title: '通勤', note: commuteNote, cols: [
        { label: '去程', value: fmtDurationMinutes(data.commuteBefore), sub: '上班路上' },
        { label: '返程', value: fmtDurationMinutes(data.commuteAfter), sub: '下班路上' },
        { label: '每日通勤', value: fmtDurationMinutes(data.commuteTotal), sub: data.commuteMode, color: '#fff' }
      ]
    },
    overtime: {
      title: '加班', note: isLeave ? '调休口径' : '给钱口径', cols: isLeave ? [
        { label: '今日加班', value: hoursText(data.otTodayHours), sub: '换成调休' },
        { label: '本月加班', value: hoursText(data.otMonthHours), sub: '累计时长' },
        { label: '剩余调休', value: hoursText(data.leaveEarned - data.leaveUsed), sub: '已用 ' + hoursText(data.leaveUsed) }
      ] : [
        { label: '今日加班费', value: data.otTodayMoney, sub: hoursText(data.otTodayHours) },
        { label: '本月加班费', value: data.otMonthMoney, sub: hoursText(data.otMonthHours) },
        { label: '累计加班', value: hoursText(data.otAllHours), sub: `${data.otCount} 条记录`, color: '#fff' }
      ]
    },
    ledger: {
      title: '记账', note: `覆盖 ${data.ledgerDays} 天`, cols: [
        { label: '本月支出', value: data.spendMonth, sub: `日均 ${data.spendAvg}` },
        { label: '折算工作日', value: data.spendWork, sub: '按时薪折算', color: '#fff' },
        { label: '今日支出', value: data.spendToday, sub: `本月 ${data.ledgerCount} 笔` }
      ]
    },
    life: {
      title: '生命消耗',
      note: lifeOn
        ? `累计 ${data.lifeHours.toLocaleString()} 小时${data.lifeJobs > 1 ? ` · ${data.lifeJobs} 段工作` : ''}`
        : '未设置入职日期',
      cols: [
        { label: '入职天数', value: (lifeOn ? data.lifeTenure : 0) + ' 天' },
        { label: '打工天数', value: (lifeOn ? data.lifeWorkDays : 0) + ' 天' },
        { label: '折合生命', value: (lifeOn ? data.lifeDays.toFixed(1) : '0') + ' 天' },
        { label: '已换工资', value: lifeOn ? fmtMoneyCompact(data.lifeEarned) : '¥0', color: '#fff' }
      ]
    },
    year: {
      title: '年度概览', note: data.yearDays, cols: [
        { label: '年度已赚', value: data.yearEarned || '¥0.00' },
        { label: '年度进度', value: data.yearProgress || '0%' },
        { label: '剩余预计', value: data.yearRemain || '¥0.00' },
        { label: '年度消费', value: data.yearSpend || '¥0.00', color: '#fff' }
      ]
    }
  };

  visibleOrder.forEach(key => {
    if (key === 'countdown') {
      drawCountdownBlock(cursor);
    } else if (key === 'salary') {
      drawSalaryBlock(cursor);
    } else if (statCards[key]) {
      drawShareStatCard(ctx, pad, cursor, statW, statH, statCards[key].title, statCards[key].note, statCards[key].cols);
    }
    cursor += sectionHeight(key);
  });

  // 页脚
  ctx.strokeStyle = '#222';
  ctx.beginPath();
  ctx.moveTo(pad, footerY);
  ctx.lineTo(W - pad, footerY);
  ctx.stroke();

  ctx.font = `500 26px ${SHARE_FONT}`;
  ctx.fillStyle = faint;
  ctx.fillText('千薪万苦 · 把薪水变成看得见的时间', pad, footerY + 54);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9bc200';
  ctx.fillText('gaoyunqiang.netlify.app', W - pad, footerY + 54);
  ctx.textAlign = 'left';

  ctx.font = `400 22px ${SHARE_FONT}`;
  ctx.fillStyle = '#555';
  ctx.fillText('数据仅保存在本地，不上传任何服务器', pad, footerY + 102);

  return canvas;
}

function generateShareCardBlob() {
  const canvas = drawShareCard();
  return new Promise(resolve => {
    if (canvas.toBlob) {
      canvas.toBlob(blob => resolve(blob), 'image/png');
      return;
    }
    // 老浏览器兜底：dataURL 转 Blob
    try {
      const bin = atob(canvas.toDataURL('image/png').split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/png' }));
    } catch (e) {
      resolve(null);
    }
  });
}

// 重新生成预览图：勾选变化后调用
async function refreshSharePreview() {
  const token = ++shareRenderToken;
  const blob = await generateShareCardBlob();
  // 生成期间勾选又变了，丢弃这次旧结果
  if (token !== shareRenderToken) return;
  if (!blob) {
    showToast('分享图生成失败');
    return;
  }
  shareCardBlob = blob;
  if (shareCardUrl) URL.revokeObjectURL(shareCardUrl);
  shareCardUrl = URL.createObjectURL(blob);
  document.getElementById('sharePreviewImg').src = shareCardUrl;

  let canShare = false;
  try {
    const file = new File([blob], shareCardName(), { type: 'image/png' });
    canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  } catch (e) {
    canShare = false;
  }
  document.getElementById('shareNativeBtn').style.display = canShare ? '' : 'none';
}

// 同步勾选按钮的选中态，并按自定义顺序排列
function syncShareOptions() {
  const wrap = document.getElementById('shareOptions');
  if (wrap) {
    shareOrder.forEach(key => {
      const btn = wrap.querySelector(`.share-option[data-section="${key}"]`);
      if (btn) wrap.appendChild(btn);
    });
  }
  document.querySelectorAll('#shareOptions .share-option').forEach(btn => {
    btn.classList.toggle('active', !!shareSections[btn.dataset.section]);
  });
}

// 分享选项：按住拖动（触摸需长按或明显移动）调整模块顺序，松手后保存并重新生成预览
function initShareOptionDrag() {
  const wrap = document.getElementById('shareOptions');
  if (!wrap) return;
  let pressTimer = null;
  let dragEl = null;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let baseRect = null;

  const clearPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };

  // 让被拖动的选项跟随指针：以「起始位置 + 指针位移」为目标，抵消换位带来的布局偏移
  const moveDragEl = (x, y) => {
    if (!dragEl || !baseRect) return;
    const targetLeft = baseRect.left + (x - startX);
    const targetTop = baseRect.top + (y - startY);
    dragEl.style.transform = 'none';
    const layout = dragEl.getBoundingClientRect();
    const dx = targetLeft - layout.left;
    const dy = targetTop - layout.top;
    dragEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
  };

  // 插入到目标位置，并用 FLIP 让其余选项平滑让位
  const reorderTo = (target, x) => {
    const others = Array.from(wrap.querySelectorAll('.share-option')).filter(el => el !== dragEl);
    others.forEach(el => {
      el.style.transition = 'none';
      el.style.transform = '';
    });
    const before = others.map(el => el.getBoundingClientRect());

    const rect = target.getBoundingClientRect();
    const after = x > rect.left + rect.width / 2;
    wrap.insertBefore(dragEl, after ? target.nextSibling : target);

    others.forEach((el, i) => {
      const a = before[i];
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        el.style.transition = '';
        return;
      }
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth;
      el.style.transition = 'transform .16s ease';
      el.style.transform = '';
      el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
    });
    moved = true;
  };

  // 进入拖动状态：元素浮起，并捕获指针，保证拖出选项区域也能收到移动事件
  const beginDrag = () => {
    if (!dragEl || dragging) return;
    dragging = true;
    baseRect = dragEl.getBoundingClientRect();
    dragEl.style.transition = 'none';
    dragEl.classList.add('dragging');
    wrap.classList.add('reordering');
    if (navigator.vibrate) navigator.vibrate(8);
    if (pointerId !== null) {
      try { dragEl.setPointerCapture(pointerId); } catch (e) { /* 忽略不支持的情况 */ }
    }
  };

  wrap.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.share-option');
    if (!btn || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragEl = btn;
    pointerId = e.pointerId;
    dragging = false;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    clearPress();
    // 鼠标按住即可拖动；触摸长按或移动超过阈值后进入排序，避免误触
    if (e.pointerType === 'mouse') beginDrag();
    else pressTimer = setTimeout(beginDrag, 260);
  });

  wrap.addEventListener('pointermove', e => {
    if (!dragEl) return;
    if (!dragging) {
      // 长按生效前移动超过阈值，直接进入拖动而不是取消
      if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
        clearPress();
        beginDrag();
      }
      if (!dragging) return;
    }
    e.preventDefault();
    // 被拖动的选项浮在指针下，取指针位置下方最靠前的其他选项作为落点
    const stack = document.elementsFromPoint(e.clientX, e.clientY);
    let target = null;
    for (const node of stack) {
      const chip = node.closest ? node.closest('.share-option') : null;
      if (chip && chip !== dragEl && wrap.contains(chip)) { target = chip; break; }
    }
    if (target) reorderTo(target, e.clientX);
    moveDragEl(e.clientX, e.clientY);
  }, { passive: false });

  const finish = () => {
    clearPress();
    if (dragEl && dragging) {
      const el = dragEl;
      el.classList.remove('dragging');
      wrap.classList.remove('reordering');
      // 松手后平滑落回最终位置
      el.style.transition = 'transform .18s ease';
      el.style.transform = '';
      setTimeout(() => {
        el.style.transition = '';
        el.style.transform = '';
      }, 200);
      shareOrder = Array.from(wrap.querySelectorAll('.share-option')).map(b => b.dataset.section);
      saveShareOrder();
      if (moved) {
        // 拖动结束后拦截紧随其后的 click，避免误切换勾选
        el.dataset.skipClick = '1';
        setTimeout(() => { delete el.dataset.skipClick; }, 500);
        refreshSharePreview();
      }
    }
    dragging = false;
    dragEl = null;
    pointerId = null;
    baseRect = null;
  };
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  wrap.addEventListener('pointerleave', () => { if (!dragging) clearPress(); });
  wrap.addEventListener('contextmenu', e => { if (dragging) e.preventDefault(); });

  // 拖动结束后拦截这次 click，避免误切换勾选
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.share-option');
    if (btn && btn.dataset.skipClick) {
      delete btn.dataset.skipClick;
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// 勾选 / 取消分享模块；至少保留一个模块，避免生成空图
function toggleShareSection(section) {
  if (!(section in shareSections)) return;
  const activeCount = Object.values(shareSections).filter(Boolean).length;
  if (shareSections[section] && activeCount <= 1) {
    showToast('至少保留一个分享模块');
    return;
  }
  shareSections[section] = !shareSections[section];
  syncShareOptions();
  refreshSharePreview();
}

async function openShareModal() {
  shareCardBlob = null;
  document.getElementById('shareModal').classList.add('show');
  syncShareOptions();
  await refreshSharePreview();
}

function closeShareModal() {
  shareRenderToken++; // 取消尚未完成的预览图生成
  const modal = document.getElementById('shareModal');
  if (modal) modal.classList.remove('show');
  const img = document.getElementById('sharePreviewImg');
  if (img) img.removeAttribute('src');
  shareCardBlob = null;
  if (shareCardUrl) {
    URL.revokeObjectURL(shareCardUrl);
    shareCardUrl = '';
  }
}

async function shareNativeCard() {
  if (!shareCardBlob) return;
  try {
    const file = new File([shareCardBlob], shareCardName(), { type: 'image/png' });
    await navigator.share({
      files: [file],
      title: '千薪万苦 · 今日战绩',
      text: '看看我今天这一秒赚了多少'
    });
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    showToast('分享未完成，请稍后重试');
  }
}

// ============ 统计页分类 ============
// 统计卡片按「看一看 / 算一算」分组展示；新增卡片时只需放进对应 panel，
// 需要新增分类时在 #statsTabs 里补一个 .stats-tab 即可。
let statsTab = 'data';

function selectStatsTab(cat) {
  statsTab = cat;
  document.querySelectorAll('#statsTabs .stats-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  document.querySelectorAll('.stats-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.cat === cat);
  });
  updateStats();
}

// ============ 页面导航 ============
function switchScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-screen="${name}"]`);
  if (navItem) navItem.classList.add('active');

  if (name === 'timer') updateTimer();
  if (name === 'ledger') renderLedger();
  if (name === 'stats') updateStats();
  if (name === 'overtime') {
    renderOvertime();
    updateOvertimePreview();
  }
  if (name === 'settings') {
    fillSettingsForm();
  }
}

// ============ 轻提示 ============
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============ 数据备份 ============
function qxwkDataKeys() {
  return Object.keys(localStorage).filter(k => k.startsWith('qianxwk_'));
}

// 汇率与节假日缓存可自动重新获取，不参与导出
function isQxwkCacheKey(key) {
  return key === RATE_CACHE_KEY || key.startsWith(HOLIDAY_CACHE_PREFIX);
}

function qxwkBackupKeys() {
  return qxwkDataKeys().filter(k => !isQxwkCacheKey(k));
}

function exportQxwkData() {
  const data = {};
  qxwkBackupKeys().forEach(k => { data[k] = localStorage.getItem(k); });
  const payload = {
    app: 'qianxwk',
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qianxwk-backup-' + fmtDateKey(new Date()) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
  showToast('已导出数据备份');
}

function triggerQxwkImport() {
  const input = document.getElementById('qxwkImportFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function importQxwkData(event) {
  const input = event && event.target;
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    let payload;
    try {
      payload = JSON.parse(reader.result);
    } catch (e) {
      showToast('备份文件不是有效的 JSON');
      return;
    }
    if (!payload || payload.app !== 'qianxwk' || !payload.data || typeof payload.data !== 'object') {
      showToast('备份文件格式不正确');
      return;
    }
    const keys = Object.keys(payload.data).filter(k => k.startsWith('qianxwk_'));
    if (!keys.length) {
      showToast('备份文件中没有可导入的数据');
      return;
    }
    let entries;
    try {
      entries = keys.map(k => {
        const v = payload.data[k];
        if (typeof v === 'string') return [k, v];
        if (v && typeof v === 'object') return [k, JSON.stringify(v)];
        return null;
      }).filter(Boolean);
    } catch (e) {
      showToast('备份文件内容无法读取');
      return;
    }
    if (!entries.length) {
      showToast('备份文件中没有可导入的数据');
      return;
    }
    if (!confirm('导入备份将覆盖当前本地数据，确定继续吗？')) return;

    const backup = {};
    qxwkDataKeys().forEach(k => { backup[k] = localStorage.getItem(k); });
    try {
      qxwkDataKeys().forEach(k => localStorage.removeItem(k));
      entries.forEach(([k, v]) => localStorage.setItem(k, v));
      alert('导入成功，页面将重新加载');
      location.reload();
    } catch (e) {
      try {
        qxwkDataKeys().forEach(k => localStorage.removeItem(k));
        Object.keys(backup).forEach(k => localStorage.setItem(k, backup[k]));
      } catch (e2) { /* 回滚失败时保留原数据尽力恢复 */ }
      showToast('导入失败：' + e.message);
    }
  };
  reader.onerror = function () { showToast('读取备份文件失败'); };
  reader.readAsText(file);
  if (input) input.value = '';
}

// ============ 全量刷新 ============
function updateAll() {
  updateTimer();
  updateStats();
  renderLedger();
}

// ============ 初始化 ============
// 首次进入（本地还没保存过参数）时直接停在设置页，先把工作参数填了
let isFirstRun = false;
try { isFirstRun = !localStorage.getItem('qianxwk_settings'); } catch (e) { isFirstRun = false; }

load();
populateCurrencySelect();
fillSettingsForm();
renderDevices();
renderJobHistory();
initOvertime();
initShareOptionDrag();
updateAll();
refreshHolidays(); // 异步联网更新节假日，不阻塞首屏渲染
refreshRates();    // 异步联网更新外币汇率，不阻塞首屏渲染
maybePromptCustomWorkday(); // 自定义模式下每月首次打开时弹窗确认

if (isFirstRun) switchScreen('settings');

// 设置页自动保存：输入 / 选择 / 切换即时写入本地，无需保存按钮
['input', 'change', 'click'].forEach(evt => {
  document.getElementById('screen-settings').addEventListener(evt, persistSettings);
});

// 每秒定时刷新：跨天/跨月检查与界面计时更新
setInterval(() => {
  // 跨过零点后自动重新拉取汇率，避免应用长期开着仍沿用昨天的汇率
  const today = fmtDateKey(new Date());
  if (today !== fxDay) { fxDay = today; refreshRates(); }
  // 跨月后重新检查：自定义模式每月自动弹窗一次
  const monthKey = today.slice(0, 7);
  if (monthKey !== fxMonthKey) { fxMonthKey = monthKey; maybePromptCustomWorkday(); }

  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen) {
    const id = activeScreen.id;
    if (id === 'screen-timer') updateTimer();
    if (id === 'screen-stats') {
      updatePaidLeave();
      updateStats();
    }
    // 记账图表收入与计时页一致，每秒实时累计
    if (id === 'screen-ledger') refreshLedgerStatsIncome();
  }
}, 1000);

// 点击遮罩空白处关闭弹窗
document.getElementById('customWorkdayModal').addEventListener('click', function(e) {
  if (e.target === this) closeCustomWorkdayModal();
});
document.getElementById('ledgerModal').addEventListener('click', function(e) {
  if (e.target === this) closeLedgerModal();
});
document.getElementById('ledgerMonthModal').addEventListener('click', function(e) {
  if (e.target === this) closeLedgerMonthModal();
});
document.getElementById('jobHistoryModal').addEventListener('click', function(e) {
  if (e.target === this) closeJobHistoryModal();
});
document.getElementById('shareModal').addEventListener('click', function(e) {
  if (e.target === this) closeShareModal();
});
document.getElementById('pickerModal').addEventListener('click', function(e) {
  if (e.target === this) closePicker();
});

// 点击所有带 data-picker 的输入框时，统一打开自定义日期 / 时间选择器
document.addEventListener('click', function(e) {
  const input = e.target && e.target.closest ? e.target.closest('input[data-picker]') : null;
  if (!input) return;
  e.preventDefault();
  openPickerForInput(input);
});
document.addEventListener('keydown', function(e) {
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement
    && document.activeElement.matches && document.activeElement.matches('input[data-picker]')) {
    e.preventDefault();
    openPickerForInput(document.activeElement);
  }
});

// 禁用移动端手指缩放：viewport 之外再拦掉 iOS 的 gesture 与多指触摸
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
document.addEventListener('touchmove', function(e) {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// 快捷键：Esc 关闭所有弹窗并回到计时页
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const pickerOverlay = document.getElementById('pickerModal');
    if (pickerOverlay && pickerOverlay.classList.contains('show')) {
      closePicker();
      return;
    }
    closeCustomWorkdayModal();
    closeLedgerModal();
    closeLedgerMonthModal();
    closeJobHistoryModal();
    closeShareModal();
    switchScreen('timer');
  }
});

// ============ 离线应用：注册后台服务 ============
// 以本地文件方式打开时浏览器不允许注册后台服务，仅在 HTTP(S) 或 localhost 环境启用
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service Worker 注册失败：', err);
    });
  });
}
