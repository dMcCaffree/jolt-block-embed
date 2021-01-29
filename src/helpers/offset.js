function offset(el) {
  if (typeof el.getBoundingClientRect === 'function') {
    const rect = el.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom };
  } else {
    return {top: -100, left: -100, width: 0, height: 0, bottom: 'auto'}
  }

}

export default offset;
