const XLSX = require("xlsx");

const regions = ["华东", "华南", "华北", "西南", "华中"];
const cities = { 华东: "上海", 华南: "深圳", 华北: "北京", 西南: "成都", 华中: "武汉" };
const customers = ["启明集团", "远洋科技", "恒信实业", "新程教育", "云帆医疗", "锐达物流", "华景零售", "初心食品", "博远制造", "青川能源", "和光传媒", "星野文旅"];
const statuses = ["进行中", "已完成", "待启动", "已暂停"];

const aoa = [
  ["2025 年度项目台账", "", "", "", "", "", "", ""],
  [],
  ["订单编号", "大区", "客户名称", "城市", "年份", "合同金额", "状态", "签约日期"],
];

for (let i = 0; i < 21; i++) {
  const region = regions[i % regions.length];
  const year = 2023 + (i % 3);
  aoa.push([
    "RT-" + String(1001 + i),
    region,
    customers[i % customers.length],
    cities[region],
    year,
    80 + ((i * 137) % 700),
    statuses[(i * 3) % statuses.length],
    new Date(year, (i * 5) % 12, 1 + ((i * 7) % 26)),
  ]);
}

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!merges"] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
  { s: { r: 3, c: 1 }, e: { r: 5, c: 1 } },
  { s: { r: 6, c: 1 }, e: { r: 8, c: 1 } },
];
ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 13 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "项目台账");
XLSX.writeFile(wb, "D:/readtree/samples/项目台账.xlsx");
XLSX.writeFile(wb, "D:/readtree/samples/项目台账.xls", { bookType: "biff8" });

console.log("written", ws["!ref"]);
