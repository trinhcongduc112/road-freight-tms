import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { Modules, Actions, p } from "../config/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/masterDataController.js";

export const masterDataRouter = Router();

masterDataRouter.use(authenticate, attachOrgScope);

/* ── CUSTOMER ── */
masterDataRouter.get("/customers", asyncHandler(ctrl.listCustomers));
masterDataRouter.get("/customers/:id", asyncHandler(ctrl.getCustomer));
masterDataRouter.post("/customers", requirePermission(p(Modules.CUSTOMER, Actions.CREATE)), asyncHandler(ctrl.createCustomer));
masterDataRouter.put("/customers/:id", requirePermission(p(Modules.CUSTOMER, Actions.UPDATE)), asyncHandler(ctrl.updateCustomer));
masterDataRouter.delete("/customers/:id", requirePermission(p(Modules.CUSTOMER, Actions.DELETE)), asyncHandler(ctrl.deleteCustomer));

/* ── PRODUCT ── */
masterDataRouter.get("/products", asyncHandler(ctrl.listProducts));
masterDataRouter.get("/products/:id", asyncHandler(ctrl.getProduct));
masterDataRouter.post("/products", requirePermission(p(Modules.PRODUCT, Actions.CREATE)), asyncHandler(ctrl.createProduct));
masterDataRouter.put("/products/:id", requirePermission(p(Modules.PRODUCT, Actions.UPDATE)), asyncHandler(ctrl.updateProduct));
masterDataRouter.delete("/products/:id", requirePermission(p(Modules.PRODUCT, Actions.DELETE)), asyncHandler(ctrl.deleteProduct));

/* ── VEHICLE ── */
masterDataRouter.get("/vehicles", asyncHandler(ctrl.listVehicles));
masterDataRouter.get("/vehicles/:id", asyncHandler(ctrl.getVehicle));
masterDataRouter.post("/vehicles", requirePermission(p(Modules.VEHICLE, Actions.CREATE)), asyncHandler(ctrl.createVehicle));
masterDataRouter.put("/vehicles/:id", requirePermission(p(Modules.VEHICLE, Actions.UPDATE)), asyncHandler(ctrl.updateVehicle));
masterDataRouter.delete("/vehicles/:id", requirePermission(p(Modules.VEHICLE, Actions.DELETE)), asyncHandler(ctrl.deleteVehicle));

/* ── DRIVER ── */
masterDataRouter.get("/drivers", asyncHandler(ctrl.listDrivers));
masterDataRouter.get("/drivers/:id", asyncHandler(ctrl.getDriver));
masterDataRouter.post("/drivers", requirePermission(p(Modules.DRIVER, Actions.CREATE)), asyncHandler(ctrl.createDriver));
masterDataRouter.put("/drivers/:id", requirePermission(p(Modules.DRIVER, Actions.UPDATE)), asyncHandler(ctrl.updateDriver));
masterDataRouter.delete("/drivers/:id", requirePermission(p(Modules.DRIVER, Actions.DELETE)), asyncHandler(ctrl.deleteDriver));

/* ── SERVICE ── */
masterDataRouter.get("/services", asyncHandler(ctrl.listServices));
masterDataRouter.get("/services/:id", asyncHandler(ctrl.getService));
masterDataRouter.post("/services", requirePermission(p(Modules.SERVICE, Actions.CREATE)), asyncHandler(ctrl.createService));
masterDataRouter.put("/services/:id", requirePermission(p(Modules.SERVICE, Actions.UPDATE)), asyncHandler(ctrl.updateService));
masterDataRouter.delete("/services/:id", requirePermission(p(Modules.SERVICE, Actions.DELETE)), asyncHandler(ctrl.deleteService));

/* ── IMPORT (bulk Excel rows) ── */
masterDataRouter.post("/customers/import",       requirePermission(p(Modules.CUSTOMER, Actions.CREATE)), asyncHandler(ctrl.importCustomers));
masterDataRouter.post("/products/import",        requirePermission(p(Modules.PRODUCT,  Actions.CREATE)), asyncHandler(ctrl.importProducts));
masterDataRouter.post("/vehicles/import",        requirePermission(p(Modules.VEHICLE,  Actions.CREATE)), asyncHandler(ctrl.importVehicles));
masterDataRouter.post("/drivers/import",         requirePermission(p(Modules.DRIVER,   Actions.CREATE)), asyncHandler(ctrl.importDrivers));
masterDataRouter.post("/customer-groups/import", requirePermission(p(Modules.CUSTOMER, Actions.CREATE)), asyncHandler(ctrl.importCustomerGroups));
masterDataRouter.post("/services/import",        requirePermission(p(Modules.SERVICE,  Actions.CREATE)), asyncHandler(ctrl.importServices));

/* ── CUSTOMER GROUP ── */
masterDataRouter.get("/customer-groups", asyncHandler(ctrl.listCustomerGroups));
masterDataRouter.post("/customer-groups", requirePermission(p(Modules.CUSTOMER, Actions.CREATE)), asyncHandler(ctrl.createCustomerGroup));
masterDataRouter.put("/customer-groups/:id", requirePermission(p(Modules.CUSTOMER, Actions.UPDATE)), asyncHandler(ctrl.updateCustomerGroup));
masterDataRouter.delete("/customer-groups/:id", requirePermission(p(Modules.CUSTOMER, Actions.DELETE)), asyncHandler(ctrl.deleteCustomerGroup));

/* ── PRODUCT CATEGORY ── */
masterDataRouter.get("/product-categories",        asyncHandler(ctrl.listProductCategories));
masterDataRouter.get("/product-categories/:id",    asyncHandler(ctrl.getProductCategory));
masterDataRouter.post("/product-categories",       requirePermission(p(Modules.PRODUCT, Actions.CREATE)), asyncHandler(ctrl.createProductCategory));
masterDataRouter.put("/product-categories/:id",    requirePermission(p(Modules.PRODUCT, Actions.UPDATE)), asyncHandler(ctrl.updateProductCategory));
masterDataRouter.delete("/product-categories/:id", requirePermission(p(Modules.PRODUCT, Actions.DELETE)), asyncHandler(ctrl.deleteProductCategory));
masterDataRouter.post("/product-categories/import", requirePermission(p(Modules.PRODUCT, Actions.CREATE)), asyncHandler(ctrl.importProductCategories));
