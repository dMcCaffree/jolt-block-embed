function HttpClient() {
  this.get = (url, callback) => {
    let request = new XMLHttpRequest();
    request.onreadystatechange = () => {
      if (request.readyState === 4 && request.status === 200 && callback)
        callback(request.responseText);
    };

    request.open("GET", url, true);
    request.send(null);
  };

  this.post = (url, data, callback) => {
    let request = new XMLHttpRequest();
    request.open("POST", url, true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.send(JSON.stringify(data));
    request.onload = function() {
      callback(this.responseText);
    };
  }
}

export default HttpClient;
