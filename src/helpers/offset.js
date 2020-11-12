function offset(el) {
  const rect = el.getBoundingClientRect();

  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export default offset;
