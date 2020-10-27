import "./jolt-block.scss";
import create from "./helpers/create";
import buildAudioInner from "./components/AudioInner";
import buildTextInner from "./components/TextInner";
import createEventListeners from "./helpers/createEventListeners";
import getUrlParameter from "./helpers/getUrlParameter";
import addStyleTag from "./helpers/addStyleTag";
import getParameterByName from "./helpers/getParameterbyName";

(function () {
  if (getParameterByName('jid')) {
    // Load in the script for setup
    // GET blog settings
    // Display builder with options from current blog pre-filled
  }

  // MVP 0.1
  // 1. Grab blog ID
  // 2. GET blog and make sure analyticsEnabled = true;
  // 3. Set tracking visit type conditions:
  //      - Words on page, time on page, scroll amount = read vs skim vs bounce
  //      - Should be set so it will always track *SOMETHING*, bounce worst case maybe on page leave
  // 4. Make a call to Plaudy with whichever tracking event needs to be tracked.

  // MVP 0.2
  // 1. Load all other widgets into the page where they go (take time to make sure this happens async and always after main content loads)
  //      - This should be done in order of visibility, with comments probably always being last
  // 2.
})();
