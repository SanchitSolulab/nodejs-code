const express = require("express");

const router = express.Router();

const { isAuthenticated } = require("../common/middlewares/authCheck");
const { isAdmin } = require("../common/middlewares/isAdmin");

const users = require("./users");
const contest = require("./contests");
const votes = require("./votes");
const category = require("./category");
const country = require("./country");
const reason = require("./reason");
const faq = require("./faq");
const admin = require("./admin");

router.use(isAuthenticated);

router.use("/users", users);
router.use("/contests", contest);
router.use("/votes", votes);
router.use("/category", category);
router.use("/country", country);
router.use("/reason", reason);
router.use("/faq", faq);

router.use(isAdmin);

router.use("/admin", admin);
module.exports = router;
