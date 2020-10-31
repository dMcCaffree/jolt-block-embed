function getWordCount(el) {
  var text = getText(el);

  return text.split(/\s+/).length;

  function getText(el) {
    return el.innerText;
  }
}

export default getWordCount;
