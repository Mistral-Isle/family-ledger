// Soft silhouettes drawn on the shared 24-unit category grid.
const bag =
  "M5 8Q3 8 3 11v7q0 3 3 3h12q3 0 3-3v-7q0-3-2-3ZM8 8V6a4 4 0 0 1 8 0v2";
const home =
  "M3 11q-1-1 1-3l6-5q2-2 4 0l6 5q2 2 1 3M5 10v8q0 3 3 3h8q3 0 3-3v-8M9 21v-6q0-2 2-2h2q2 0 2 2v6";
const gift =
  "M5 9h14q2 0 2 2v1q0 2-2 2H5q-2 0-2-2v-1q0-2 2-2ZM5 14v5q0 2 2 2h10q2 0 2-2v-5M12 9v12M12 9C2 9 6 0 10 5ZM12 9C22 9 18 0 14 5Z";
const screen = "M6 3h12q3 0 3 3v9q0 3-3 3H6q-3 0-3-3V6q0-3 3-3ZM8 22h8M12 18v4";
const book = "M12 6Q7 3 3 5v15q4-2 9 0 5-2 9 0V5q-4-2-9 1ZM12 6v14";
const ticket =
  "M5 5h14q2 0 2 2v2q-4 3 0 6v2q0 2-2 2H5q-2 0-2-2v-2q4-3 0-6V7q0-2 2-2ZM9 8v1M9 12v1M9 16v.1";
const train =
  "M6 3q6-2 12 0 2 1 2 4v9q0 3-3 3H7q-3 0-3-3V7q0-3 2-4ZM5 11h14M8 15h.1M16 15h.1M8 19l-2 3M16 19l2 3";
const taxi =
  "M3 12q0-2 2-3l2-4q1-2 3-2h4q2 0 3 2l2 4q2 1 2 3v5q0 2-2 2H5q-2 0-2-2ZM5 10h14M7 14h1M16 14h1M6 19v2M18 19v2M10 5h4";
const shield =
  "M12 3q3 2 7 2 2 0 2 2c0 7-3 12-9 14C6 19 3 14 3 7q0-2 2-2 4 0 7-2Z";
const phone = "M8 2h8q3 0 3 3v14q0 3-3 3H8q-3 0-3-3V5q0-3 3-3ZM10 5h4M11 19h2";
const mug = "M4 7h12v8q0 5-6 5t-6-5ZM16 8h2q4 0 3 4t-5 3M8 3v1M12 2v2";
const sparkle =
  "M12 3C13 9 15 11 21 12 15 13 13 15 12 21 11 15 9 13 3 12 9 11 11 9 12 3ZM20 2v4M18 4h4";
const box =
  "M5 7q-2 1-2 3v8q0 2 2 3h14q2-1 2-3v-8q0-2-2-3l-5-4q-2-1-4 0ZM3 9h18M12 9v12M9 4l7 5";
const envelope =
  "M9 2h6q3 0 3 3v14q0 3-3 3H9q-3 0-3-3V5q0-3 3-3ZM6 7q6 7 12 0M10 15h4";
const plane =
  "M12 2q2 0 2 4v3l6 4q2 1 1 3l-7-2v4l2 2q1 2-1 1l-3-1-3 1q-2 1-1-1l2-2v-4l-7 2q-1-2 1-3l6-4V6q0-4 2-4Z";
const suitcase =
  "M8 6V4q0-2 2-2h4q2 0 2 2v2M6 6h12q3 0 3 3v10q0 3-3 3H6q-3 0-3-3V9q0-3 3-3ZM8 7v14M16 7v14";
const health =
  "M8 7V5q0-2 2-2h4q2 0 2 2v2M6 7h12q3 0 3 3v8q0 3-3 3H6q-3 0-3-3v-8q0-3 3-3ZM12 11v6M9 14h6";
const rounded: Record<string, string> = {
  "fork.knife": "M4 3v5q0 3 3 3t3-3V3M7 3v18M19 3q-5 4-4 9 0 1 4 1M19 3v18",
  "cart.fill":
    "M2 3h1q2 0 2 2l2 10q.4 2 3 2h7q2 0 3-2l1-6q.5-2-2-2H6M9 21h.1M18 21h.1",
  "house.fill": home,
  "gift.fill": gift,
  "book.fill": book,
  "tram.fill": train,
  sparkles: sparkle,
  "cross.case.fill": health,
  "shippingbox.fill": bag,
  "car.side.fill": taxi,
  "category:car": taxi,
  airplane: plane,
  "category:plane": plane,
  iphone: phone,
  "category:phone": phone,
  "suitcase.fill": suitcase,
  "category:travel": suitcase,
  "envelope.fill": envelope,
  "envelope.open.fill": envelope,
  "category:envelope": envelope,
  "category:transport-1": taxi,
  "category:transport-2": train,
  "category:transport-3": ticket + "M13 10q2-2 4-1M13 14l4-4",
  "category:transport-4":
    "M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 14l2-5q1-2 3-2h3M8 17h7q2 0 2-2l-2-10q0-2 2-2h2M9 7v3h5",
  "category:income-1": bag + "M4 13q8 5 16 0M11 13h2",
  "category:income-2":
    "M6 4h12q2 0 2 2v10H4V6q0-2 2-2ZM4 16l-2 3q-1 2 2 2h16q3 0 2-2l-2-3",
  "category:income-4": home,
  "category:income-5": envelope,
  "category:income-6":
    "M3 6q0-3 3-3h6q2 0 3 1l6 6q2 2 0 4l-7 7q-2 2-4 0l-6-6q-1-1-1-3ZM8 7h.1",
  "category:dining-3":
    "M4 7h16M6 7l1.5 13q.2 2 2.5 2h4q2.3 0 2.5-2L18 7M5 4h14M12 4l2-3h4M8 12q4 3 8 0",
  "category:shopping-1": bag,
  "category:shopping-2":
    "M6 8C1 6 4 1 7 4q5-3 10 0c3-3 6 2 1 4q2 7-6 7T6 8ZM9 9h.1M15 9h.1M11 12h2M8 15q-4 0-4 3t4 2q0 2 2 2h4q2 0 2-2 4 1 4-2t-4-3",
  "category:shopping-3": "M7 3v4M17 3v4M5 7h14v3q0 5-7 5T5 10ZM12 15v4q0 3 4 3",
  "category:shopping-4":
    "M8 3q4 4 8 0l5 4q2 2 0 3l-3 1v8q0 2-2 2H8q-2 0-2-2v-8l-3-1q-2-1 0-3Z",
  "category:shopping-5":
    "M8 3h9q3 0 3 2v1M12 3v5M9 8h6v2q4 1 4 4v5q0 3-3 3H8q-3 0-3-3v-5q0-3 4-4ZM9 15h6M9 18h4",
  "category:shopping-6":
    "M8 11h8v9q0 2-2 2h-4q-2 0-2-2ZM9 11V6q0-1 1-2l3-2q2-1 2 1v8M8 16h8",
  "category:shopping-7":
    "M5 5h14l2 4v10q0 2-2 2H5q-2 0-2-2V9ZM3 9h18M10 5v7h4V5M7 17h4",
  "category:car-1": "M8 3v4M16 3v4M6 7h12v3q0 5-6 5t-6-5ZM12 15v6",
  "category:car-2":
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 17V7h4q5 0 3 4-1 2-7 1",
  "category:car-3": "M4 21V7q0-3 3-3h10q3 0 3 3v14M4 10h16M12 14v2M12 20v1",
  "category:car-4": shield + "M8 12l2 2q1 1 2 0l4-5",
  "category:car-7":
    "M7 3h10q3 0 3 3v13q0 3-3 2l-3-1q-2-1-4 0l-3 1q-3 1-3-2V6q0-3 3-3ZM12 7v6M12 17h.1",
  "category:digital-1": sparkle,
  "category:digital-2": screen + "M9 8l-2 2 2 2M15 8l2 2-2 2",
  "category:digital-3":
    "M7 3h10q4 0 4 4v10q0 4-4 4H7q-4 0-4-4V7q0-4 4-4ZM10 8q0-1 1 0l5 3q1 1 0 2l-5 3q-1 1-1 0Z",
  "category:digital-4": phone,
  "category:leisure-2":
    "M3 20V8M21 20V8M3 16h18v-3q0-3-3-3H6q-3 0-3 3M6 10V6q0-2 2-2h8q2 0 2 2v4M12 5v5",
  "category:leisure-3": ticket,
  "category:leisure-4":
    "M6 3h12q3 0 3 3v12q0 3-3 3H6q-3 0-3-3V6q0-3 3-3ZM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4",
  "category:home-1": home,
  "category:home-2":
    "M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13ZM8 15q0 4 4 4",
  "category:home-3":
    "M6 21V6q0-3 3-3h6q3 0 3 3v15M3 21h18M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-5h4v5",
  "category:home-4":
    "M3 11l7-7q2-2 4 0l7 7M5 10v9q0 2 2 2h3M21 13q-4-2-5 2l-5 5q-1 2 1 2l5-5q4 1 4-4Z",
  "category:social-1": envelope,
  "category:social-2": gift,
  "category:health-1": health,
  "category:pet-2":
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM6 5q9 5 13 13M3 12q7-5 9-9M12 21q1-7 9-9",
  "category:pet-3": health,
  "category:leisure-6":
    "M6 19V11a6 6 0 0 1 12 0v8M4 19h16v3H4ZM12 8v8M9 12h6M9 5q0-3 3-3t3 3",
  "chart.bar.fill":
    "M4 21h16M5 17V12q0-2 2-2t2 2v5M10 17V5q0-2 2-2t2 2v12M15 17V9q0-2 2-2t2 2v8",
  "category:study-1": book,
  "category:study-2": screen + "M8 8h8M8 12h5",
  "category:purchase-2": phone,
  "category:purchase-3":
    "M7 2h10q3 0 3 3v14q0 3-3 3H7q-3 0-3-3V5q0-3 3-3ZM4 9h16M8 5v1M8 13v3",
  "category:other-1":
    "M7 3h10q3 0 3 3v13q0 3-3 2l-3-1q-2-1-4 0l-3 1q-3 1-3-2V6q0-3 3-3ZM9 8h6M9 12h6M9 16h3",
};
export const roundedCategoryIconLayers = Object.fromEntries(
  Object.entries(rounded).map(([name, d]) => [name, [{ d }]]),
);
