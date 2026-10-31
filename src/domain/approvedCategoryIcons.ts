// Approved category icon set. Lucide-derived geometry uses the license below.
/*
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
export type CategoryIconLayer = { d: string; transform?: string };
export const approvedCategoryIcons: {
  name: string;
  label: string;
  group: string;
  layers: CategoryIconLayer[];
}[] = [
  {
    name: "category:income-1",
    label: "收入 · 工资奖金",
    group: "财务",
    layers: [
      {
        d: "M12 12h.01",
      },
      {
        d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
      },
      {
        d: "M22 13a18.15 18.15 0 0 1-20 0",
      },
      {
        d: "M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2Z",
      },
    ],
  },
  {
    name: "category:income-2",
    label: "收入 · 副业收入",
    group: "财务",
    layers: [
      {
        d: "M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z",
      },
      {
        d: "M20.054 15.987H3.946",
      },
    ],
  },
  {
    name: "category:income-3",
    label: "收入 · 福利补贴",
    group: "财务",
    layers: [
      {
        d: "M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16",
      },
      {
        d: "m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95",
      },
      {
        d: "m2 15 6 6",
      },
      {
        d: "m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91",
      },
    ],
  },
  {
    name: "category:income-4",
    label: "收入 · 公积金",
    group: "财务",
    layers: [
      {
        d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M13.744 17.736a6 6 0 1 1-7.48-7.48",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M15 6h1v4",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "m6.134 14.768.866-.5 2 3.464",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M10 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:income-5",
    label: "收入 · 红包礼金",
    group: "财务",
    layers: [
      {
        d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "m9 8 3 3v7",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "m12 11 3-3",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M9 12h6",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M9 16h6",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:income-6",
    label: "收入 · 二手出售",
    group: "财务",
    layers: [
      {
        d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M7 7.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M7 7h10v10",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M7 17 17 7",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:income-7",
    label: "收入 · 其他收入",
    group: "财务",
    layers: [
      {
        d: "M13.744 17.736a6 6 0 1 1-7.48-7.48",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M15 6h1v4",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "m6.134 14.768.866-.5 2 3.464",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M10 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M5 12h14",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M12 5v14",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:dining-1",
    label: "餐饮 · 日常用餐",
    group: "餐饮",
    layers: [
      {
        d: "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z",
      },
      {
        d: "M7 21h10",
      },
      {
        d: "M19.5 12 22 6",
      },
      {
        d: "M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62",
      },
      {
        d: "M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62",
      },
      {
        d: "M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62",
      },
    ],
  },
  {
    name: "category:dining-2",
    label: "餐饮 · 买菜食材",
    group: "餐饮",
    layers: [
      {
        d: "M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46",
      },
      {
        d: "M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z",
      },
      {
        d: "M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z",
      },
    ],
  },
  {
    name: "category:dining-3",
    label: "餐饮 · 饮品",
    group: "餐饮",
    layers: [
      {
        d: "m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8",
      },
      {
        d: "M5 8h14",
      },
      {
        d: "M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0",
      },
      {
        d: "m12 8 1-6h2",
      },
    ],
  },
  {
    name: "category:dining-4",
    label: "餐饮 · 零食水果",
    group: "餐饮",
    layers: [
      {
        d: "M12 6.528V3a1 1 0 0 1 1-1h0",
      },
      {
        d: "M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21",
      },
    ],
  },
  {
    name: "category:shopping-1",
    label: "购物 · 日用",
    group: "购物",
    layers: [
      {
        d: "M12 22v-9",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M15 3v5a1 1 0 0 0 1 1h5",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:shopping-2",
    label: "购物 · 生活小物",
    group: "购物",
    layers: [
      {
        d: "M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1Z",
      },
      {
        d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",
      },
      {
        d: "M10 12h4",
      },
    ],
  },
  {
    name: "category:shopping-3",
    label: "购物 · 数码配件",
    group: "购物",
    layers: [
      {
        d: "M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z",
      },
      {
        d: "M17 21v-2",
      },
      {
        d: "M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10",
      },
      {
        d: "M21 21v-2",
      },
      {
        d: "M3 5V3",
      },
      {
        d: "M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z",
      },
      {
        d: "M7 5V3",
      },
    ],
  },
  {
    name: "category:shopping-4",
    label: "购物 · 衣鞋配饰",
    group: "购物",
    layers: [
      {
        d: "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z",
      },
    ],
  },
  {
    name: "category:shopping-5",
    label: "购物 · 个人护理",
    group: "购物",
    layers: [
      {
        d: "M10.5 2v4",
      },
      {
        d: "M14 2H7a2 2 0 0 0-2 2",
      },
      {
        d: "M19.29 14.76A6.67 6.67 0 0 1 17 11a6.6 6.6 0 0 1-2.29 3.76c-1.15.92-1.71 2.04-1.71 3.19 0 2.22 1.8 4.05 4 4.05s4-1.83 4-4.05c0-1.16-.57-2.26-1.71-3.19",
      },
      {
        d: "M9.607 21H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h7V7a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3",
      },
    ],
  },
  {
    name: "category:shopping-6",
    label: "购物 · 美妆",
    group: "购物",
    layers: [
      {
        d: "M8 11h8v11H8ZM9 11V5l6-3v9M6 22h12",
      },
    ],
  },
  {
    name: "category:shopping-7",
    label: "购物 · 快递寄件",
    group: "购物",
    layers: [
      {
        d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
      },
      {
        d: "M12 22V12",
      },
      {
        d: "M3.29 7L12 12L20.71 7",
      },
      {
        d: "m7.5 4.27 9 5.15",
      },
    ],
  },
  {
    name: "category:car-1",
    label: "汽车 · 充电",
    group: "交通",
    layers: [
      {
        d: "M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5",
      },
      {
        d: "M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16",
      },
      {
        d: "M2 21h13",
      },
      {
        d: "M3 7h11",
      },
      {
        d: "m9 11-2 3h3l-2 3",
      },
    ],
  },
  {
    name: "category:car-2",
    label: "汽车 · 停车",
    group: "交通",
    layers: [
      {
        d: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z",
      },
      {
        d: "M9 17V7h4a3 3 0 0 1 0 6H9",
      },
    ],
  },
  {
    name: "category:car-3",
    label: "汽车 · 过路费",
    group: "交通",
    layers: [
      {
        d: "M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M6 8h4",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M6 18h4",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M14 8h4",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M14 18h4",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M13.744 17.736a6 6 0 1 1-7.48-7.48",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M15 6h1v4",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "m6.134 14.768.866-.5 2 3.464",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M10 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:car-4",
    label: "汽车 · 保险",
    group: "交通",
    layers: [
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
      },
      {
        d: "m9 12 2 2 4-4",
      },
    ],
  },
  {
    name: "category:car-5",
    label: "汽车 · 保养维修",
    group: "交通",
    layers: [
      {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",
      },
    ],
  },
  {
    name: "category:car-6",
    label: "汽车 · 洗车",
    group: "交通",
    layers: [
      {
        d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M7 14h.01",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M17 14h.01",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M5 10h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M5 18v2",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M19 18v2",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:car-7",
    label: "汽车 · 违章罚款",
    group: "交通",
    layers: [
      {
        d: "M13 16H8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M14 8H8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M16 12H8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M12 8L12 12",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M12 16L12.01 16",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:digital-1",
    label: "数字服务 · AI",
    group: "生活",
    layers: [
      {
        d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
      },
      {
        d: "M20 2v4",
      },
      {
        d: "M22 4h-4",
      },
      {
        d: "M2 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
      },
    ],
  },
  {
    name: "category:digital-2",
    label: "数字服务 · 软件工具",
    group: "生活",
    layers: [
      {
        d: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2Z",
      },
      {
        d: "M10 4v4",
      },
      {
        d: "M2 8h20",
      },
      {
        d: "M6 4v4",
      },
    ],
  },
  {
    name: "category:digital-3",
    label: "数字服务 · 影音会员",
    group: "生活",
    layers: [
      {
        d: "M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z",
      },
      {
        d: "M12 17v4",
      },
      {
        d: "M8 21h8",
      },
      {
        d: "M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2Z",
      },
    ],
  },
  {
    name: "category:digital-4",
    label: "数字服务 · 话费",
    group: "生活",
    layers: [
      {
        d: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-16a2 2 0 0 1 2 -2Z",
      },
      {
        d: "M12 18h.01",
      },
    ],
  },
  {
    name: "category:transport-1",
    label: "交通 · 打车",
    group: "交通",
    layers: [
      {
        d: "M10 2h4",
      },
      {
        d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8",
      },
      {
        d: "M7 14h.01",
      },
      {
        d: "M17 14h.01",
      },
      {
        d: "M5 10h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2Z",
      },
      {
        d: "M5 18v2",
      },
      {
        d: "M19 18v2",
      },
    ],
  },
  {
    name: "category:transport-2",
    label: "交通 · 公交地铁",
    group: "交通",
    layers: [
      {
        d: "M8 3.1V7a4 4 0 0 0 8 0V3.1",
      },
      {
        d: "m9 15-1-1",
      },
      {
        d: "m15 15 1-1",
      },
      {
        d: "M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z",
      },
      {
        d: "m8 19-2 3",
      },
      {
        d: "m16 19 2 3",
      },
    ],
  },
  {
    name: "category:transport-3",
    label: "交通 · 火车机票",
    group: "交通",
    layers: [
      {
        d: "M10.5 17h1.227a2 2 0 0 0 1.345-.52L18 12",
      },
      {
        d: "m12 13.5 3.794.506",
      },
      {
        d: "m3.173 8.18 11-5a2 2 0 0 1 2.647.993L18.56 8",
      },
      {
        d: "M6 10V8",
      },
      {
        d: "M6 14v1",
      },
      {
        d: "M6 19v2",
      },
      {
        d: "M4 8h16a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2Z",
      },
    ],
  },
  {
    name: "category:transport-4",
    label: "交通 · 两轮电动车",
    group: "交通",
    layers: [
      {
        d: "M21 4h-3.5l2 11.05",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M6.95 17h5.142c.523 0 .95-.406 1.063-.916a6.5 6.5 0 0 1 5.345-5.009",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M17 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M2 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:leisure-1",
    label: "娱乐 · 聚餐",
    group: "生活",
    layers: [
      {
        d: "M8 22h8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M7 10h10",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M12 15v7",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M8 22h8",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M7 10h10",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M12 15v7",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:leisure-2",
    label: "娱乐 · 住宿",
    group: "生活",
    layers: [
      {
        d: "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8",
      },
      {
        d: "M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4",
      },
      {
        d: "M12 4v6",
      },
      {
        d: "M2 18h20",
      },
    ],
  },
  {
    name: "category:leisure-3",
    label: "娱乐 · 门票",
    group: "生活",
    layers: [
      {
        d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
      },
      {
        d: "M13 5v2",
      },
      {
        d: "M13 17v2",
      },
      {
        d: "M13 11v2",
      },
    ],
  },
  {
    name: "category:leisure-4",
    label: "娱乐 · 电影",
    group: "生活",
    layers: [
      {
        d: "m12.296 3.464 3.02 3.956",
      },
      {
        d: "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z",
      },
      {
        d: "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      },
      {
        d: "m6.18 5.276 3.1 3.899",
      },
    ],
  },
  {
    name: "category:leisure-5",
    label: "娱乐 · 游戏",
    group: "生活",
    layers: [
      {
        d: "M6 11L10 11",
      },
      {
        d: "M8 9L8 13",
      },
      {
        d: "M15 12L15.01 12",
      },
      {
        d: "M18 10L18.01 10",
      },
      {
        d: "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z",
      },
    ],
  },
  {
    name: "category:home-1",
    label: "居住 · 房租",
    group: "居家",
    layers: [
      {
        d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M16 7.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:home-2",
    label: "居住 · 水电燃气",
    group: "居家",
    layers: [
      {
        d: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:home-3",
    label: "居住 · 物业",
    group: "居家",
    layers: [
      {
        d: "M10 12h4",
      },
      {
        d: "M10 8h4",
      },
      {
        d: "M14 21v-3a2 2 0 0 0-4 0v3",
      },
      {
        d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
      },
      {
        d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
      },
    ],
  },
  {
    name: "category:home-4",
    label: "居住 · 搬家维修",
    group: "居家",
    layers: [
      {
        d: "M16 12v4",
      },
      {
        d: "M16 6a2 2 0 0 1 1.414.586l4 4A2 2 0 0 1 22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 .586-1.414l4-4A2 2 0 0 1 8 6z",
      },
      {
        d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
      },
      {
        d: "M2 14h20",
      },
      {
        d: "M8 12v4",
      },
    ],
  },
  {
    name: "category:social-1",
    label: "人情往来 · 礼金红包",
    group: "生活",
    layers: [
      {
        d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "m9 8 3 3v7",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "m12 11 3-3",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M9 12h6",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M9 16h6",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:social-2",
    label: "人情往来 · 送礼",
    group: "生活",
    layers: [
      {
        d: "M12 7v14",
      },
      {
        d: "M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8",
      },
      {
        d: "M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5",
      },
      {
        d: "M4 7h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1Z",
      },
    ],
  },
  {
    name: "category:social-3",
    label: "人情往来 · 请客",
    group: "生活",
    layers: [
      {
        d: "M12 3V2",
      },
      {
        d: "m15.4 17.4 3.2-2.8a2 2 0 1 1 2.8 2.9l-3.6 3.3c-.7.8-1.7 1.2-2.8 1.2h-4c-1.1 0-2.1-.4-2.8-1.2l-1.302-1.464A1 1 0 0 0 6.151 19H5",
      },
      {
        d: "M2 14h12a2 2 0 0 1 0 4h-2",
      },
      {
        d: "M4 10h16",
      },
      {
        d: "M5 10a7 7 0 0 1 14 0",
      },
      {
        d: "M5 14v6a1 1 0 0 1-1 1H2",
      },
    ],
  },
  {
    name: "category:health-1",
    label: "医疗健康 · 看病检查",
    group: "生活",
    layers: [
      {
        d: "M11 2v2",
      },
      {
        d: "M5 2v2",
      },
      {
        d: "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1",
      },
      {
        d: "M8 15a6 6 0 0 0 12 0v-3",
      },
      {
        d: "M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
      },
    ],
  },
  {
    name: "category:health-2",
    label: "医疗健康 · 药品",
    group: "生活",
    layers: [
      {
        d: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z",
      },
      {
        d: "m8.5 8.5 7 7",
      },
    ],
  },
  {
    name: "category:pet-1",
    label: "宠物 · 食品",
    group: "生活",
    layers: [
      {
        d: "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M7 21h10",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M19.5 12 22 6",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M9 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M16 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M18 16a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:pet-2",
    label: "宠物 · 用品",
    group: "生活",
    layers: [
      {
        d: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:pet-3",
    label: "宠物 · 医疗",
    group: "生活",
    layers: [
      {
        d: "M9 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M16 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M18 16a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M5 12h14",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M12 5v14",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:pet-4",
    label: "宠物 · 服务",
    group: "生活",
    layers: [
      {
        d: "M10 4 8 6",
      },
      {
        d: "M17 19v2",
      },
      {
        d: "M2 12h20",
      },
      {
        d: "M7 19v2",
      },
      {
        d: "M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5",
      },
    ],
  },
  {
    name: "category:study-1",
    label: "学习 · 书籍",
    group: "生活",
    layers: [
      {
        d: "M12 7v14",
      },
      {
        d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
      },
    ],
  },
  {
    name: "category:study-2",
    label: "学习 · 课程培训",
    group: "生活",
    layers: [
      {
        d: "M2 3h20",
      },
      {
        d: "M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3",
      },
      {
        d: "m7 21 5-5 5 5",
      },
    ],
  },
  {
    name: "category:purchase-1",
    label: "大额支出 · 购车",
    group: "购物",
    layers: [
      {
        d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M16 7.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M7 14h.01",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M17 14h.01",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M5 10h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2Z",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M5 18v2",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M19 18v2",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:purchase-2",
    label: "大额支出 · 数码",
    group: "购物",
    layers: [
      {
        d: "M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8",
      },
      {
        d: "M10 19v-3.96 3.15",
      },
      {
        d: "M7 19h5",
      },
      {
        d: "M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2Z",
      },
    ],
  },
  {
    name: "category:purchase-3",
    label: "大额支出 · 家电",
    group: "购物",
    layers: [
      {
        d: "M3 6h3",
      },
      {
        d: "M17 6h.01",
      },
      {
        d: "M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-16a2 2 0 0 1 2 -2Z",
      },
      {
        d: "M7 13a5 5 0 1 0 10 0a5 5 0 1 0 -10 0",
      },
      {
        d: "M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5",
      },
    ],
  },
  {
    name: "category:other-1",
    label: "其他 · 手续费",
    group: "财务",
    layers: [
      {
        d: "M13 16H8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M14 8H8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M16 12H8",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",
        transform: "translate(0 0) scale(0.78)",
      },
      {
        d: "M19 5L5 19",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M4 6.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0",
        transform: "translate(14 14) scale(0.4)",
      },
      {
        d: "M15 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0",
        transform: "translate(14 14) scale(0.4)",
      },
    ],
  },
  {
    name: "category:other-2",
    label: "其他 · 其他支出",
    group: "财务",
    layers: [
      {
        d: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0",
      },
      {
        d: "M17 12h.01",
      },
      {
        d: "M12 12h.01",
      },
      {
        d: "M7 12h.01",
      },
    ],
  },
  {
    name: "category:car-rounded",
    label: "汽车 · 圆润侧面",
    group: "交通",
    layers: [
      {
        d: "M3.5 10.6C4.8 9.5 5 5.3 9.8 5.3c4.1 0 5.6 2.8 8.6 5.1l1.8.5q1.8.5 1.8 2.3V15q0 1.6-1.6 1.6H20M4 16.6H3.4Q2 16.6 2 15.2v-2.5q0-1.6 1.5-2.1ZM8 16.6h8M4 10.6h14.7M10.5 5.4v5.2 M4 16.6a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M16 16.6a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
      },
    ],
  },
];
