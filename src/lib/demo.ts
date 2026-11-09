import type { SheetData, TreeConfig, WorkbookData } from "../types";

const REGIONS = [
  { name: "华东", cities: ["上海", "杭州", "南京", "苏州"] },
  { name: "华南", cities: ["深圳", "广州", "厦门", "东莞"] },
  { name: "华北", cities: ["北京", "天津", "济南", "石家庄"] },
  { name: "西南", cities: ["成都", "重庆", "昆明", "贵阳"] },
  { name: "华中", cities: ["武汉", "长沙", "郑州", "合肥"] },
];

const OWNERS = ["陈晓", "李然", "王珂", "周宁", "赵敏", "孙悦", "林涛", "何静"];
const STATUSES = ["进行中", "已完成", "待启动", "已暂停"];
const PREFIXES = ["星云", "青禾", "远山", "澜图", "知行", "拾光", "云栖", "北辰", "溪谷", "望岳", "光年", "木棉"];
const SUFFIXES = ["门店数字化", "供应链升级", "客户中台", "数据治理", "渠道协同", "智能客服", "仓储优化", "会员运营"];
const YEARS = [2023, 2024, 2025];
const AMOUNT_FORMAT = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function pad2(value: number): string {
  return value < 10 ? "0" + value : String(value);
}

function projectSheet(): SheetData {
  const headers = [
    "项目名称",
    "大区",
    "城市",
    "年份",
    "负责人",
    "状态",
    "合同金额（万元）",
    "启动日期",
  ];
  const rows: string[][] = [];

  for (let index = 0; index < 64; index++) {
    const region = REGIONS[index % REGIONS.length];
    const city = region.cities[(index + Math.floor(index / 5)) % region.cities.length];
    const year = YEARS[(index * 2 + 1) % 3];
    const owner = index % 19 === 0 ? "" : OWNERS[(index * 5 + 2) % OWNERS.length];
    const status = index % 23 === 0 ? "" : STATUSES[(index * 3 + 1) % STATUSES.length];
    const amount = 60 + ((index * 137) % 880) + ((index * 7) % 10) / 10;
    const month = 1 + ((index * 5) % 12);
    const day = 1 + ((index * 11) % 27);

    rows.push([
      pad2(index + 1) + " · " + PREFIXES[index % PREFIXES.length] + SUFFIXES[(index * 3) % SUFFIXES.length],
      region.name,
      city,
      String(year),
      owner,
      status,
      AMOUNT_FORMAT.format(amount),
      year + "-" + pad2(month) + "-" + pad2(day),
    ]);
  }

  return {
    name: "项目清单",
    headers,
    rows,
    headerRow: 1,
    totalRows: rows.length,
  };
}

function customerSheet(): SheetData {
  const headers = ["客户名称", "大区", "客户等级", "合作年份", "负责人"];
  const names = [
    "启明集团",
    "远洋科技",
    "恒信实业",
    "新程教育",
    "云帆医疗",
    "锐达物流",
    "华景零售",
    "初心食品",
    "博远制造",
    "青川能源",
    "和光传媒",
    "星野文旅",
    "安泰建设",
    "知行软件",
  ];
  const levels = ["A", "B", "C"];
  const rows = names.map((name, index) => {
    const region = REGIONS[(index * 3) % REGIONS.length];
    return [
      name,
      region.name,
      levels[(index * 2) % 3],
      String(YEARS[(index + 1) % 3]),
      OWNERS[(index * 3 + 1) % OWNERS.length],
    ];
  });

  return {
    name: "客户名单",
    headers,
    rows,
    headerRow: 1,
    totalRows: rows.length,
  };
}

export const demoConfig: TreeConfig = {
  dimensions: [
    { field: "大区", split: false },
    { field: "年份", split: false },
    { field: "状态", split: false },
  ],
  emptyLabel: "(空)",
};

export function createDemoWorkbook(): WorkbookData {
  return {
    fileName: "示例数据.xlsx",
    sheets: [projectSheet(), customerSheet()],
  };
}
