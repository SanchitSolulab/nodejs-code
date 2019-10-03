const axios = require("axios");
const sha1 = require("sha1");
const utf8 = require("utf8");
const moment = require("moment");

const { jwplayer } = require("./../../config/config");

const generateURLWithSignature = async urlParams => {
  let strUrlParams = "";
  const shared_secret_from_config = urlParams.shared_secret;
  delete urlParams.shared_secret;
  Object.keys(urlParams).map(key => {
    if (key === "download_url") {
      let s3UrlForUpload = urlParams[key];
      s3UrlForUpload = s3UrlForUpload.replace(/\s/g, "-");
      urlParams[key] = s3UrlForUpload;
    }
    urlParams[key] = utf8.encode(urlParams[key].toString());
    urlParams[key] = encodeURIComponent(urlParams[key].toString());
    strUrlParams.length === 0 ? (strUrlParams += `${key}=${urlParams[key]}`) : (strUrlParams += `&${key}=${urlParams[key]}`);
  });
  strUrlParams += `&api_signature=${sha1(strUrlParams + shared_secret_from_config)}`;
  return strUrlParams;
};

exports.upload = async ({ title, s3Url }) => {
  try {
    const urlParams = ({ api_format, api_key, api_nonce, api_timestamp = 0, shared_secret } = { ...jwplayer });
    urlParams.api_timestamp = moment().format("X");
    urlParams.api_nonce = urlParams.api_nonce();
    urlParams.download_url = s3Url;
    urlParams.title = title;
    const strUrlParams = await generateURLWithSignature(urlParams);

    const jwpResponse = await axios.get(`http://api.jwplatform.com/v1/videos/create?${strUrlParams}`);
    const { data } = jwpResponse;
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getManifestData = async ({ mediaId }) => {
  try {
    const strURL = `https://cdn.jwplayer.com/v2/media/${mediaId}?format=json`;
    const mediaData = await axios.get(strURL);
    const { data } = mediaData;
    return data;
  } catch (error) {
    throw error;
  }
};
