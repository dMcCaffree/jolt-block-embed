import "./jolt-block.scss";
import create from "./helpers/create";
import getParameterByName from "./helpers/getParameterbyName";
import HttpClient from "./helpers/HttpClient";

(function () {
  if (getParameterByName('jid')) {
    // Load in the script for setup
    // GET blog settings
    // Display builder with options from current blog pre-filled
  }

  // MVP 0.1
  const client = new HttpClient();

  class JoltBlock {
    constructor() {
      this.blogId = window.joltBlockId;
      this.settings = null;
    }

    getBlogSettings(id) {
      const url = `https://api.joltblock.com/settings/${id}`;

      client.get(url, response => {
        response = JSON.parse(response);
        console.log('RESPONSE:', response);
        this.settings = response;
      });
    }
  }

  window.JoltBlock = new JoltBlock();
  window.JoltBlock.getBlogSettings(window.JoltBlock.blogId);

  // 2. Check if article exists / create a new one if not
  // 3. Set tracking visit type conditions:
  //      - Words on page, time on page, scroll amount = read vs skim vs bounce
  //      - Should be set so it will always track *SOMETHING*, bounce worst case maybe on page leave
  // 4. Make a call to Plaudy with whichever tracking event needs to be tracked.

  // MVP 0.2
  // 1. Load all other widgets into the page where they go (take time to make sure this happens async and always after main content loads)
  //      - This should be done in order of visibility, with comments probably always being last
  // 2.
})();
