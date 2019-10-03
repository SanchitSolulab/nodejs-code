const express = require('express');

const router = express.Router();
const {
  save, getAll, remove, getCountryInformation, getCountryForListing, getCountryWiseContests, getStatesOfCountry, getCitiesOfState, getCountryTalents,getAllContestCountryWise
} = require('../controllers/country');
router.get('/all-contest-countryWise', getAllContestCountryWise);
router.get('/country-filter-talent', getCountryTalents);
router.post('/', save);
router.get('/', getAll);
router.get('/get-country-for-listing', getCountryForListing);
router.get('/:countryName', getCountryInformation);
router.delete('/:countryName', remove);
router.get('/countryWise-contests/:countryName', getCountryWiseContests);
router.get('/states-of-country/:countryName', getStatesOfCountry);
router.get('/cities-of-state/:stateName', getCitiesOfState);

module.exports = router;
