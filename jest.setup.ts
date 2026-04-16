// import { jest } from "@jest/globals";

// // 1. Mock Next.js Server context (Headers/Cookies)
// jest.mock("next/headers", () => ({
//   cookies: jest.fn(() => ({
//     get: jest.fn(),
//     set: jest.fn(),
//   })),
//   headers: jest.fn(() => new Map()),
// }));

// // 2. Mock Google Sheets (Prevents real API calls)
// // Replace the path below with the actual path to your connectToSheets file
// jest.mock("@/lib/services/helper.service", () => ({
//   connectToSheets: jest.fn().mockResolvedValue({
//     glAuth: {},
//     glSheets: {
//       spreadsheets: {
//         values: {
//           append: jest.fn().mockResolvedValue({ data: { success: true } }),
//         },
//       },
//     },
//   }),
// }));
