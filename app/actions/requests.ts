// "use server";

// import * as requestsService from "@/lib/services/requests.service";
// import { handleAction } from "@/lib/error/actions-handler";
// import {
//   FindRequestsSchema,
//   FindRequestBidsSchema,
//   InsertRequestBidSchema,
//   InsertRequestSchema,
//   UpdateRequestSchema,
// } from "@/lib/validation/requests";

// // TODO: ADD AUTHENTICATION TO SERVER ACTION ENDPOINTS FOR SECURITY (THIS)

// export async function getRequests(filters: FindRequestsSchema) {
//   return await handleAction(() => requestsService.getRequests(filters));
// }

// export async function createRequest(data: InsertRequestSchema) {
//   return await handleAction(() => requestsService.createRequest(data));
// }

// export async function removeRequest(id: string) {
//   return await handleAction(() => requestsService.removeRequest(id));
// }

// export async function editRequest(id: string, data: UpdateRequestSchema) {
//   return await requestsService.editRequest(id, data);
// }
