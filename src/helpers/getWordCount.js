function getWordCount(el) {
  var text = getText(el);

  return text.split(/\s+/).length;

  function getText(el) {
    let ret = ' ';
    let length = el.childNodes.length;
    for(let i = 0; i < length; i++) {
      let node = el.childNodes[i];
      if(node.nodeType !== 8) {
        ret += node.nodeType !== 1 ? node.nodeValue : getWordCount(node);
      }
    }

    return ret + ' ';
  }
}

export default getWordCount;
