const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const need = p => {
  const full = path.join(root, p);
  if (!fs.existsSync(full)) throw new Error(`Нет обязательного файла: ${p}`);
};
[
  'index.html', 'manifest.webmanifest', 'service-worker.js', 'stats-config.js',
  'map/index.html', 'map/resource-map.html', 'map/craft.html', 'map/talents.html', 'map/alchemy.html',
  'map/web-bridge.js', 'map/usage-stats.js', 'map/styles.css', 'map/app.js', 'map/craft.js', 'map/talents.js', 'map/alchemy.js',
  'data/web-bundle.js', 'data/crafting.json', 'data/alchemy.json', 'data/squads.json', 'data/raid-bosses.json',
  'data/champions-altars-data.js',
  'map/assets/world-map.png', 'map/assets/odium-world-icon.png',
  'cloudflare-stats/src/worker.mjs', 'cloudflare-stats/schema.sql', 'cloudflare-stats/wrangler.jsonc',
  'cloudflare-stats/queries/today.sql', 'cloudflare-stats/queries/history.sql',
  'cloudflare-stats/scripts/show-stats.mjs'
].forEach(need);

const crafting = json('data/crafting.json');
const alchemy = json('data/alchemy.json');
const squads = json('data/squads.json');
const raids = json('data/raid-bosses.json');
if (crafting.items?.length !== 1131) throw new Error(`Крафт: ожидалось 1131, получено ${crafting.items?.length}`);
if (alchemy.items?.length !== 53) throw new Error(`Алхимия: ожидалось 53, получено ${alchemy.items?.length}`);
if (squads.items?.length !== 18) throw new Error(`Сквады: ожидалось 18, получено ${squads.items?.length}`);
if (raids.items?.length !== 52) throw new Error(`Рейдовые боссы: ожидалось 52, получено ${raids.items?.length}`);
const drev = raids.items.find(x => x.name === 'Древобород');
if (!drev || Number(drev.id) !== 1101) throw new Error('Древобород должен иметь Wiki ID 1101');

const ctx = { window: {} };
vm.runInNewContext(read('data/champions-altars-data.js'), ctx, { filename: 'champions-altars-data.js' });
const champions = ctx.window.ODIUM_CHAMPIONS;
const altars = ctx.window.ODIUM_ALTARS;
if (!Array.isArray(champions) || champions.length !== 320) throw new Error(`Чемпионы: ожидалось 320 точек, получено ${champions?.length}`);
if (!Array.isArray(altars) || altars.length !== 111) throw new Error(`Алтари: ожидалось 111 точек, получено ${altars?.length}`);
const countBy = (items, predicate) => items.filter(predicate).length;
const championCounts = {50:100,60:100,75:20,76:100};
for (const [level, expected] of Object.entries(championCounts)) {
  const actual = countBy(champions, p => Number(p.level) === Number(level));
  if (actual !== expected) throw new Error(`Чемпионы ${level}+: ожидалось ${expected}, получено ${actual}`);
}
const altarCounts = {
  'solo:50':15, 'solo:60':17, 'solo:65':4,
  'group:50':31, 'group:60':44
};
for (const [key, expected] of Object.entries(altarCounts)) {
  const [type, level] = key.split(':');
  const actual = countBy(altars, p => p.type === type && Number(p.level) === Number(level));
  if (actual !== expected) throw new Error(`Алтари ${type} ${level}+: ожидалось ${expected}, получено ${actual}`);
}
for (const point of [...champions, ...altars]) {
  const values = [point.worldX, point.worldY, point.worldZ].map(Number);
  if (!values.every(Number.isFinite)) throw new Error('Чемпионы/алтари: найдены некорректные координаты');
  const mapX = 0.00750184083 * values[0] + 1436.63038;
  const mapY = 0.00746632039 * values[1] + 1962.75598;
  if (mapX < 0 || mapX > 3168 || mapY < 0 || mapY > 4096) {
    throw new Error(`Точка вне карты: ${values.join(' ')}`);
  }
}

for (const page of ['map/index.html','map/resource-map.html','map/craft.html','map/talents.html','map/alchemy.html']) {
  const html = read(page);
  if (!html.includes('../data/web-bundle.js') || !html.includes('web-bridge.js')) throw new Error(`${page}: нет web bridge`);
  if (!html.includes('../stats-config.js') || !html.includes('usage-stats.js')) throw new Error(`${page}: нет анонимной статистики`);
  if (!html.includes("connect-src 'self' https://*.workers.dev")) throw new Error(`${page}: CSP не разрешает Worker статистики`);
  if (!html.includes('../manifest.webmanifest')) throw new Error(`${page}: нет manifest`);
}
const resourceMap = read('map/resource-map.html');
if (!resourceMap.includes('../data/champions-altars-data.js')) throw new Error('Карта: не подключены данные чемпионов/алтарей');

const menu = read('map/index.html');
if (!menu.includes('Полезные функции') || !menu.includes('disabled')) throw new Error('Нет неактивной кнопки «Полезные функции»');
const bridge = read('map/web-bridge.js');
if (!bridge.includes("const VERSION = '1.6.9'")) throw new Error('Web bridge: неверная desktop-версия');
if (!bridge.includes("const WEB_VERSION = '0.3'")) throw new Error('Web bridge: неверная web-версия');

const mapApp = read('map/app.js');
for (const token of [
  'data-mode="champions"', 'data-mode="altars"',
  'function renderChampions()', 'function renderAltars()',
  'function openChampionPoint(point)', 'function openAltarPoint(point)'
]) {
  if (!mapApp.includes(token)) throw new Error(`Карта: отсутствует ${token}`);
}

const statsClient = read('map/usage-stats.js');
if (!statsClient.includes('SHA-256') || !statsClient.includes('JSON.stringify({ id })')) throw new Error('Статистика: должен отправляться только дневной ID');
if (statsClient.includes('userAgent') || statsClient.includes('geolocation') || statsClient.includes('location.pathname')) throw new Error('Статистика: обнаружен лишний пользовательский контекст');
const statsConfig = read('stats-config.js');
if (!statsConfig.includes('ODIUM_STATS_CONFIG') || !statsConfig.includes('endpoint:')) throw new Error('Статистика: нет конфигурации endpoint');
const worker = read('cloudflare-stats/src/worker.mjs');
if (!worker.includes("url.pathname !== '/heartbeat'") || !worker.includes('DELETE FROM daily_visitors')) throw new Error('Cloudflare stats Worker неполон');

const sw = read('service-worker.js');
if (!sw.includes("odium-world-web-0.3-v1.6.9") || !sw.includes('./data/champions-altars-data.js')) throw new Error('Service Worker: не обновлён кэш Web 0.3');

console.log('Web prototype verify: OK');
console.log('Desktop base: 1.6.9');
console.log('Web prototype: 0.3');
console.log('Champions: 320 points (50+=100, 60+=100, 75+=20, 76+=100)');
console.log('Altars: 111 points (solo=36, group=75)');
console.log('Anonymous stats: Cloudflare Worker + D1');
console.log(`Crafting: ${crafting.items.length}`);
console.log(`Alchemy: ${alchemy.items.length}`);
console.log(`Squads: ${squads.items.length}`);
console.log(`Raid bosses: ${raids.items.length}`);
