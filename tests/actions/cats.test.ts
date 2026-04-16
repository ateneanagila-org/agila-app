// import { createCat } from "@/app/actions/cats";
// import { db } from "@/lib/db";
// import { cats, regions, catHealthRecords } from "@/lib/db/schema";
// import { eq } from "drizzle-orm";
// import { v4 as uuidv4 } from "uuid";

// describe("Action: createCat", () => {
//   let testRegionId: string;

//   beforeAll(async () => {
//     // Create a valid region first for Foreign Key requirements
//     const [region] = await db
//       .insert(regions)
//       .values({
//         id: uuidv4(),
//         name: "ARETE", // Must be one of your REGION_NAME_VALUES
//         color: "Blue",
//       })
//       .returning();
//     testRegionId = region.id;
//   });

//   beforeEach(async () => {
//     // Clean database before each test
//     await db.delete(catHealthRecords);
//     await db.delete(cats);
//   });

//   it("should create a cat and its health record successfully", async () => {
//     const payload = {
//       name: "Pesto",
//       color: "Gray Tabby",
//       age: "Kitten",
//       sex: "Male",
//       region_id: testRegionId,
//       condition: "Healthy",
//       is_adoptable: true,
//     };

//     const result = await createCat(payload as unknown);

//     // Verify Action Response
//     expect(result?.data).toBeDefined();
//     expect(result?.data?.name).toBe("Pesto");

//     // Verify DB Row exists
//     const catInDb = await db.query.cats.findFirst({
//       where: eq(cats.id, result?.data?.id),
//     });
//     expect(catInDb).toBeDefined();
//   });
// });
