function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  var finalParam = decodeURIComponent(results[2].replace(/\+/g, ' '));
  if (finalParam) {
    return finalParam;
  } else {
    return "";
  }
}

export default getParameterByName;
