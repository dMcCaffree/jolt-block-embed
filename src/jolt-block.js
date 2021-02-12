import "./jolt-block.scss";
import getParameterByName from "./helpers/getParameterbyName";
import HttpClient from "./helpers/HttpClient";
import create from "./helpers/create";
import offset from "./helpers/offset";
import uniqueSelector from 'css-selector-generator';
import io from './lib/socket.io';
import getInheritedBackgroundColor from "./helpers/getInheritedBackgroundColor";

(function () {
  const isProduction = false;
  const baseUrl = isProduction ? 'https://api.joltblock.com' : 'http://localhost:5000';
  const wsUrl = isProduction ? 'https://api.plaudy.com' : 'http://localhost:5001';
  const iframeBaseUrl = isProduction ? 'https://app.joltblock.com' : 'http://localhost:3000';
  let socket = io(wsUrl);
  let lastURL = window.location.href.split('#')[0];
  let lastHoveredElement = null;
  let hasTrackedEvent = false;
  let tooltipIsOpen = false;
  let retryAttempt = 0;

  if (hasTrackedEvent) {
    return;
  }

  window.addEventListener('locationchange', function(){
    if (window.location.href.split('#')[0] !== lastURL) {
      lastURL = window.location.href.split('#')[0];
      if (window.Jolt && window.Jolt.pendingId) {
        socket.emit('locationchange', window.Jolt.pendingId);
      }
      retryUntilDocumentIsReady();
    }
  });

  retryUntilDocumentIsReady();

  function retryUntilDocumentIsReady() {
    if (document && document.body) {
      runJolt();
    } else {
      setTimeout(retryUntilDocumentIsReady, 100);
    }
  }

  function runJolt() {
    const mode = getParameterByName('jolt_mode');
    const token = getParameterByName('token');

    if (mode === 'edit' || window.location.hash === '#jolt_edit') {
      localStorage.setItem('jolt_mode', 'edit');
    }

    if (token) {
      localStorage.setItem('jolt_token', token);
    }

    const urlFragmentAfterSlash = window.location.href.split('?')[0].split('/')[3];
    const isArticleOverride = document.querySelector('[property="og:type"]') && document.querySelector('[property="og:type"]').content === 'article';

    if ((
      urlFragmentAfterSlash.length <= 1 ||
      urlFragmentAfterSlash === 'preview' ||
      urlFragmentAfterSlash === 'tag' ||
      urlFragmentAfterSlash === 'author' ||
      urlFragmentAfterSlash === 'tags' ||
      urlFragmentAfterSlash === 'categories' ||
      urlFragmentAfterSlash === 'authors' ||
      window.location.href.split('?')[0].endsWith('/blog') ||
      window.location.href.indexOf('localhost:') >= 0
    ) && !isArticleOverride) {
      if (localStorage.getItem('jolt_mode') === 'edit' && mode !== 'preview') {
        showEditorIsActive();
      }
      return;
    }

    if (localStorage.getItem('jolt_mode') === 'edit' && mode !== 'preview') {
      startEditMode();
    } else if (mode === 'preview') {
      startPreviewMode();
    }

    const client = new HttpClient();

    class Jolt {
      constructor() {
        this.blogId = window.joltBlockId;
        this.articleId = '';
        this.settings = null;
        this.pendingId = '';
      }

      getBlogSettings() {
        const url = `${baseUrl}/settings/${this.blogId}`;

        client.get(url, response => {
          response = JSON.parse(response);
          if (typeof response === 'object' && response.hasOwnProperty('analyticsEnabled')) {
            this.settings = response;
            if (mode === 'preview') {
              const settings = decodeURI(getParameterByName('settings'));
              this.settings = {
                ...this.settings,
                ...JSON.parse(settings),
              }
            }

            window.Jolt.getArticleId();
          }
        });
      }

      getArticleId() {
        const urlWithoutParams = window.location.href.split('?')[0];
        const encodedUrl = encodeURI(urlWithoutParams);
        const title = document.title;
        const requestUrl = `${baseUrl}/articles?url=${encodedUrl}&title=${title}&blog=${this.blogId}`;

        client.get(requestUrl, response => {
          response = JSON.parse(response);
          if (typeof response === 'object' && response.hasOwnProperty('id')) {
            this.articleId = response.id;
            client.post(`${wsUrl}/v1/events/pending`, {
              objectId: response.id,
              workspace: '5f9c471b4fd85316d520147a',
              trackedUser: this.blogId,
              data: {
                referrer: document && document.referrer ? document.referrer : '',
                url: document && document.location ? document.location.href : '',
              },
            }, id => {
              // console.log('PENDING ID:', id);
              window.Jolt.pendingId = id;
              watchAnalytics();
            });

            window.Jolt.setUpBlocks();
          }
        });
      }

      trackEvent(data) {
        hasTrackedEvent = true;
        const url = `${baseUrl}/analytics/track?blog=${data.blog}&article=${data.article}&type=${data.type}&scroll=${data.scrolled}&timeOnPage=${data.timeOnPage}`;
        client.get(url);
      }

      setUpBlocks() {
        // ===== ADD BLOCKS ===== //

        // 1 - COMMENTS
        this.addCommentBlock();
        this.addSidebar();
      }

      addCommentBlock(selector) {
        if (window.Jolt.settings && window.Jolt.settings.hasOwnProperty('commentsEnabled') && window.Jolt.settings.commentsEnabled) {
          const elementBefore = selector ? document.querySelector(selector) : document.querySelector(window.Jolt.settings.commentsElement);
          if ((elementBefore && elementBefore.length < 1) || !elementBefore) {
            retryAttempt++;
            setTimeout(this.addCommentBlock, 500);
            return;
          }

          const existingCommentsBlock = document.querySelector('.jb_block-comments');

          if (existingCommentsBlock) {
            existingCommentsBlock.remove();
          }

          const container = create('div');
          container.className = 'jb_block-container jb_block-comments';

          let background;
          if (selector) {
            background = getInheritedBackgroundColor(document.querySelector(selector));
          } else {
            background = getInheritedBackgroundColor(document.querySelector(window.Jolt.settings.commentsElement));
          }

          const iframe = create('iframe');
          iframe.className = 'jb_block-iframe jb_block-comments-iframe';
          iframe.src = `${iframeBaseUrl}/blocks/comments/${this.blogId}/${this.articleId}?background=${background ? background : ''}`;

          container.append(iframe);
          elementBefore.parentNode.insertBefore(container, elementBefore.nextSibling);

          if (typeof addDisableButtons === 'function' && localStorage.getItem('jolt_mode') === 'edit' && mode !== 'preview') {
            addDisableButtons();
          }
        } else {
          retryAttempt++;
          setTimeout(this.addCommentBlock, 500);
        }
      }

      addSidebar() {
        if (window.Jolt.settings && window.Jolt.settings.hasOwnProperty('commentsEnabled') && window.Jolt.settings.commentsEnabled) {
          const existingSidebar = document.querySelector('.jb_block-sidebar');

          if (existingSidebar) {
            existingSidebar.remove();
          }

          const container = create('div');
          container.className = 'jb_block-container jb_block-sidebar';

          const backdrop = create('div');
          backdrop.className = 'jb_backdrop';

          const iframe = create('iframe');
          iframe.className = 'jb_block-iframe jb_block-sidebar-iframe';
          iframe.src = `${iframeBaseUrl}/sidebar/${this.blogId}/${this.articleId}`;

          container.append(backdrop);
          container.append(iframe);
          document.body.append(container);

          backdrop.addEventListener('click', () => {
            container.classList.remove('open');
          });
        }
      }

      enableCommentsBlock(selector) {
        const updates = {
          commentsEnabled: true,
          commentsElement: selector,
        };

        const toolbarContainer = document.querySelector('.jb_toolbar-container iframe');

        if (toolbarContainer) {
          toolbarContainer.contentWindow.postMessage({
            type: 'change',
            data: updates,
          }, '*');
        }
        window.Jolt.settings = {
          ...window.Jolt.settings,
          ...updates,
        }
        this.addCommentBlock(selector);
        window.Jolt.closeTooltip();
      }

      disableCommentsBlock() {
        const updates = {
          commentsEnabled: false,
          commentsElement: '',
        };

        const existingCommentsBlock = document.querySelector('.jb_block-comments');
        if (existingCommentsBlock) {
          existingCommentsBlock.remove();
        }
        window.Jolt.closeTooltip();

        const tooltipIframe = document.querySelector('.jb_tooltip-container iframe');

        if (tooltipIframe) {
          tooltipIframe.contentWindow.postMessage({type: 'disable comments'}, '*');
        }

        const toolbarIframe = document.querySelector('.jb_toolbar-container iframe');

        if (toolbarIframe) {
          toolbarIframe.contentWindow.postMessage({
            type: 'change',
            data: updates,
          }, '*');
        }

        window.Jolt.settings = {
          ...window.Jolt.settings,
          ...updates,
        }
      }

      openTooltip() {
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.classList.add('show');
        tooltipIsOpen = true;
      }

      closeTooltip() {
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.classList.remove('show');
        tooltipIsOpen = false;
      }
    }

    // Listener for window.parent.postMessage() from React web app's iframe
    window.addEventListener('message', event => {
      if (event && event.data && event.data.type) {
        if (event.data.type === 'enable comments') {
          const elementSelector = uniqueSelector(lastHoveredElement.target);
          window.Jolt.enableCommentsBlock(elementSelector);
        }

        if (event.data.type === 'disable comments') {
          window.Jolt.disableCommentsBlock();
        }

        if (event.data.type === 'close') {
          window.Jolt.closeTooltip();
        }

        if (event.data.type === 'open sidebar') {
          const sidebar = document.querySelector('.jb_block-sidebar');
          if (sidebar) {
            sidebar.classList.add('open');
          }
        }

        if (event.data.type === 'close sidebar') {
          const sidebar = document.querySelector('.jb_block-sidebar');
          if (sidebar) {
            sidebar.classList.remove('open');
          }
        }

        if (event.data.type === 'exit') {
          localStorage.removeItem('jolt_mode');
          window.location = window.location.href.split('?')[0];
        }

        if (event.data.type === 'preview') {
          window.open(`${window.location.href.split('?')[0]}${event.data.data.queryString}`);
        }
      }
    });

    // Init window.Jolt and kick things off
    window.Jolt = new Jolt();
    window.Jolt.getBlogSettings();
  }

  function watchAnalytics() {
    if (window.Jolt.pendingId) {
      if (!socket.connected) {
        setTimeout(watchAnalytics, 100);
      }

      socket.emit('pageview', window.Jolt.pendingId);
    }
  }

  function addDisableButtons() {
    const disableOverlay = create('div');
    disableOverlay.className = 'jb_disable-overlay';
    disableOverlay.innerHTML = `REMOVE BLOCK`;

    const commentsBlock = document.querySelector('.jb_block-comments');

    if (!commentsBlock) {
      setTimeout(addDisableButtons, 500);
      return;
    }

    commentsBlock.append(disableOverlay);
    commentsBlock.classList.add('customize-mode');

    disableOverlay.addEventListener('click', () => {
      window.Jolt.disableCommentsBlock();
    });
  }

  //====== EDIT ======//
  function startEditMode() {
    removeAll();
    createInsertLine();
    createTooltipIframe();
    createToolbar();
    addDisableButtons();
    document.onmouseover = moveInsertLine;

    window.addEventListener('scroll', function () {
      moveInsertLine(lastHoveredElement, true);
      moveTooltip();
    });

    window.onresize = function () {
      moveInsertLine(lastHoveredElement, true);
      moveTooltip();
    }

    document.addEventListener('click', e => {
      if (e.target.className && typeof e.target.className.indexOf === 'function' && e.target.className.indexOf('jb_') < 0) {
        window.Jolt.closeTooltip();
      }
    });

    function removeAll() {
      // const allJolt = document.querySelectorAll("[class^='jb_']").remove();
    }

    function createToolbar() {
      const container = create('div');
      container.className = 'jb_toolbar-container';
      const iframe = create('iframe');
      iframe.src = `${iframeBaseUrl}/toolbar`;

      container.append(iframe);

      document.body.append(container);
    }

    function createTooltipIframe() {
      const container = create('div');
      container.className = 'jb_tooltip-container';
      const iframe = create('iframe');
      iframe.src = `${iframeBaseUrl}/blocks/tooltips/add`;

      container.append(iframe);

      document.body.append(container);
    }

    function createInsertLine() {
      const line = create('div');
      const plusButton = create('div');
      plusButton.className = 'jb_plus-button';
      plusButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40.333" height="40.332" viewBox="0 0 40.333 40.332" class="jb_plus-icon">
            <path id="np_plus_178497_000000" d="M59.9,44.8H44.8V59.9a2.53,2.53,0,1,1-5.06,0V44.8H24.632a2.53,2.53,0,1,1,0-5.06H39.738V24.632a2.53,2.53,0,0,1,5.06,0V39.738H59.9a2.47,2.47,0,0,1,2.53,2.53A2.513,2.513,0,0,1,59.9,44.8Z" transform="translate(-22.102 -22.102)" fill="#fff"/>
        </svg>
      `;

      line.className = 'jb_insert-line';
      line.append(plusButton);
      plusButton.addEventListener('click', e => {
        const elementOffset = offset(e.target);
        window.Jolt.openTooltip();
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.style.top = `${elementOffset.top - tooltipContainer.getBoundingClientRect().height + 15}px`;
        tooltipContainer.style.left = `${elementOffset.left + elementOffset.width / 2}px`;
      });

      document.body.append(line);
    }

    function moveInsertLine(e, isScroll) {
      if (tooltipIsOpen && !isScroll) {
        return;
      }

      if (tooltipIsOpen) {
        var line = document.querySelector('.jb_insert-line');
        const elementOffset = offset(e.target);
        line.style.top = `${elementOffset.top + elementOffset.height - 1}px`;
        line.style.left = `${elementOffset.left}px`;
        line.style.width = `${elementOffset.width}px`;
        return;
      }

      if (e === null) {
        return;
      }

      const elementOffset = offset(e.target);
      // CHECK IF WE SHOULD BE MOVING IT TO THE RIGHT SPOT
      if (e.target.className && typeof e.target.className === 'string' && e.target.className.indexOf('jb_') >= 0) return;

      if ((e.target.tagName !== 'DIV' && e.target.tagName !== 'SECTION' && e.target.tagName !== 'ARTICLE' && e.target.tagName !== 'H1' && e.target.tagName !== 'H2') || offset.width <= 90 || offset.height < 1) {
        if (e.target.parentNode) {
          moveInsertLine({target: e.target.parentNode});
        }
        return;
      }

      var insertLine = document.querySelector('.jb_insert-line');
      insertLine.style.top = `${elementOffset.top + elementOffset.height - 1}px`;
      insertLine.style.left = `${elementOffset.left}px`;
      insertLine.style.width = `${elementOffset.width}px`;
      lastHoveredElement = e;
    }

    function moveTooltip() {
      if (tooltipIsOpen) {
        const button = document.querySelector('.jb_plus-icon');
        const elementOffset = offset(button);
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.style.top = `${elementOffset.top - tooltipContainer.getBoundingClientRect().height + 15}px`;
        tooltipContainer.style.left = `${elementOffset.left + elementOffset.width / 2}px`;
      }
    }
  }

  //====== EDITOR MODE ON UNSUPPORTED PAGES ======//
  function showEditorIsActive() {
    const banner = create('div');
    banner.className = 'jb_banner jb_editor-active';
    banner.innerText = 'Exit Editor ⚡️';
    banner.addEventListener('click', () => {
      localStorage.removeItem('jolt_mode');
      window.location = window.location.href.split('?')[0];
    });
    document.body.append(banner);
  }

  //====== PREVIEW MODE ======//
  function startPreviewMode() {
    const closePreviewButton = create('div');
    closePreviewButton.className = 'jb_close-preview-button';
    closePreviewButton.innerHTML = 'Close preview';

    document.body.append(closePreviewButton);

    closePreviewButton.addEventListener('click', () => {
      window.close();
    });
  }


  //====== CUSTOM EVENTS ======//
  history.pushState = ( f => function pushState(){
    const ret = f.apply(this, arguments);
    window.dispatchEvent(new Event('pushstate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  })(history.pushState);

  history.replaceState = ( f => function replaceState(){
    const ret = f.apply(this, arguments);
    window.dispatchEvent(new Event('replacestate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  })(history.replaceState);

  window.addEventListener('popstate',()=>{
    window.dispatchEvent(new Event('locationchange'))
  });
})();
