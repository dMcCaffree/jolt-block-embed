import "./jolt-block.scss";
import getParameterByName from "./helpers/getParameterbyName";
import HttpClient from "./helpers/HttpClient";
import create from "./helpers/create";
import offset from "./helpers/offset";
import uniqueSelector from 'css-selector-generator';
import io from './lib/socket.io';
import getInheritedBackgroundColor from "./helpers/getInheritedBackgroundColor";
import lightOrDark from "./helpers/lightOrDark";

(function () {
  const isProduction = true;
  const baseUrl = isProduction ? 'https://api.jolt.so' : 'http://localhost:5000';
  const wsUrl = isProduction ? 'https://api.plaudy.com' : 'http://localhost:5001';
  const iframeBaseUrl = isProduction ? 'https://app.jolt.so' : 'http://localhost:3000';
  let socket = io(wsUrl);
  let lastURL = window.location.href.split('#')[0];
  let lastHoveredElement = null;
  let hasTrackedEvent = false;
  let tooltipIsOpen = false;
  let settingsIsOpen = false;
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
      urlFragmentAfterSlash === 'preview' ||
      urlFragmentAfterSlash === 'tag' ||
      urlFragmentAfterSlash === 'author' ||
      urlFragmentAfterSlash === 'tags' ||
      urlFragmentAfterSlash === 'categories' ||
      urlFragmentAfterSlash === 'authors' ||
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
        this.blocks = [];
        this.pendingId = '';
      }

      getBlocks() {
        const url = `${baseUrl}/blocks/${this.blogId}`;

        client.get(url, response => {
          response = JSON.parse(response);
          if (Array.isArray(response)) {
            this.blocks = response;
            if (mode === 'preview') {
              const blocks = decodeURI(getParameterByName('blocks'));
              const allBlocks = [].concat(response);
              const previewBlocks = JSON.parse(blocks);

              for (let i = 0; i < previewBlocks.length; i++) {
                const existingBlockIndex = allBlocks.findIndex(block => block.type === previewBlocks[i].type && block.scope === previewBlocks[i].scope);
                if (existingBlockIndex > -1) {
                  allBlocks[existingBlockIndex] = {
                    ...allBlocks[existingBlockIndex],
                    ...previewBlocks[i],
                  };
                } else {
                  allBlocks.push(previewBlocks[i]);
                }
              }

              console.log('ALL BLOCKS:', allBlocks);
              this.blocks = allBlocks;
            }

            window.Jolt.getArticleId();
          } else {
            this.blocks = [];
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
        // 1. COMMENTS - IFRAME
        this.addCommentBlock();
        this.addSidebar();

        // 2. EMAIL SUBSCRIBE FORM - JS
        this.addEmailSubscribeForm();
      }

      addCommentBlock(selector) {
        let globalCommentsBlock = null;
        if (window.Jolt.blocks) {
          const globalCommentsBlocks = window.Jolt.blocks.filter(block => block.type === 'comments' && block.status === 'active');
          if (globalCommentsBlocks) {
            globalCommentsBlock = globalCommentsBlocks[0];
          }
        } else {
          return;
        }

        if (globalCommentsBlock) {
          const elementBefore = selector ? document.querySelector(selector) : document.querySelector(globalCommentsBlock.selector);
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
          container.dataset.type = 'comments';

          const hideOverflow = create('div');
          hideOverflow.className = 'jb_hide-overflow';

          let background;
          if (selector) {
            background = getInheritedBackgroundColor(document.querySelector(selector));
          } else {
            background = getInheritedBackgroundColor(document.querySelector(globalCommentsBlock.selector));
          }

          const iframe = create('iframe');
          iframe.className = 'jb_block-iframe jb_block-comments-iframe';
          iframe.src = `${iframeBaseUrl}/blocks/comments/${this.blogId}/${this.articleId}?background=${background ? background : ''}`;

          hideOverflow.append(iframe);
          container.append(hideOverflow);
          elementBefore.parentNode.insertBefore(container, elementBefore.nextSibling);

          if (typeof addSettingsButtons === 'function' && localStorage.getItem('jolt_mode') === 'edit' && mode !== 'preview') {
            addSettingsButtons();
          }
        } else {
          retryAttempt++;
          setTimeout(this.addCommentBlock, 500);
        }
      }

      addSidebar() {
        let globalCommentsBlock = null;
        if (window.Jolt.blocks) {
          const globalCommentsBlocks = window.Jolt.blocks.filter(block => block.type === 'comments' && block.status === 'active');
          if (globalCommentsBlocks) {
            globalCommentsBlock = globalCommentsBlocks[0];
          }
        } else {
          return;
        }

        if (globalCommentsBlock) {
          const existingSidebar = document.querySelector('.jb_block-sidebar');

          if (existingSidebar) {
            existingSidebar.remove();
          }

          const container = create('div');
          container.className = 'jb_block-container jb_block-sidebar';
          container.dataset.type = 'sidebar';

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

      enableBlock(blockType, selector, data) {
        let updates = {
          status: 'active',
          type: blockType,
          scope: 'global',
        };
        if (selector) {
          updates.selector = selector;
        }
        if (data) {
          updates = {
            ...updates,
            ...data,
          }
        }

        const toolbarContainer = document.querySelector('.jb_toolbar-container iframe');

        if (toolbarContainer) {
          toolbarContainer.contentWindow.postMessage({
            type: 'change',
            data: updates,
          }, '*');
        }

        if (window.Jolt.blocks && window.Jolt.blocks.filter(block => block.type === blockType && block.scope === 'global')) {
          const globalBlockIndex = window.Jolt.blocks.findIndex(block => block.type === blockType && block.scope === 'global');
          window.Jolt.blocks[globalBlockIndex] = {
            ...window.Jolt.blocks[globalBlockIndex],
            updates,
          }
        } else {
          window.Jolt.blocks.push(updates);
        }

        if (blockType === 'comments') {
          this.addCommentBlock(selector);
        } else if (blockType === 'email subscribe') {
          this.addEmailSubscribeForm(selector);
        }
        window.Jolt.closeTooltip();
      }

      // TODO: ID is next step w/ page blocks
      disableBlock(blockType) {
        const updates = {
          status: 'disabled',
          type: blockType,
          scope: 'global',
        };

        const existingBlock = document.querySelector(`.jb_block-${blockType.replace(/ /g, '-')}`);
        if (existingBlock) {
          existingBlock.remove();
        }
        window.Jolt.closeTooltip();

        const tooltipIframe = document.querySelector('.jb_tooltip-container iframe');

        if (tooltipIframe) {
          tooltipIframe.contentWindow.postMessage({type: `disable ${blockType}`}, '*');
        }

        const toolbarIframe = document.querySelector('.jb_toolbar-container iframe');

        if (toolbarIframe) {
          toolbarIframe.contentWindow.postMessage({
            type: 'change',
            data: updates,
          }, '*');
        }

        if (window.Jolt.blocks && window.Jolt.blocks.filter(block => block.type === blockType && block.scope === 'global')) {
          const globalBlockIndex = window.Jolt.blocks.findIndex(block => block.type === blockType && block.scope === 'global');
          window.Jolt.blocks[globalBlockIndex] = {
            ...window.Jolt.blocks[globalBlockIndex],
            updates,
          }
        }
      }

      addEmailSubscribeForm(selector) {
        let globalEmailSubscribeBlock = null;
        if (window.Jolt.blocks) {
          const globalEmailSubscribeBlocks = window.Jolt.blocks.filter(block => block.type === 'email subscribe' && block.status === 'active');
          if (globalEmailSubscribeBlocks) {
            globalEmailSubscribeBlock = globalEmailSubscribeBlocks[0];
          } else {
            return;
          }
        } else {
          return;
        }

        if (globalEmailSubscribeBlock) {
          const elementBefore = selector ? document.querySelector(selector) : document.querySelector(globalEmailSubscribeBlock.selector);
          if ((elementBefore && elementBefore.length < 1) || !elementBefore) {
            retryAttempt++;
            setTimeout(this.addEmailSubscribeForm, 500);
            return;
          }

          const existingEmailSubscribeBlock = document.querySelector('.jb_block-email-subscribe');

          if (existingEmailSubscribeBlock) {
            existingEmailSubscribeBlock.remove();
          }

          // CREATE SUBSCRIBE FORM
          const background = selector ? getInheritedBackgroundColor(document.querySelector(selector)) : getInheritedBackgroundColor(document.querySelector(globalEmailSubscribeBlock.selector));
          const isDark = lightOrDark(background) === 'dark';

          const container = create('div');
          container.className = 'jb_block-container jb_block-email-subscribe';
          container.dataset.type = 'email subscribe';

          const form = create('form');
          form.className = `jb_form ${isDark ? 'dark' : 'light'}`;

          const input = create('input');
          input.className = 'jb_input';
          input.placeholder = 'Your email address';
          input.type = 'email';
          input.pattern = '[a-zA-Z0-9.-_]{1,}@[a-zA-Z.-]{2,}[.]{1}[a-zA-Z]{2,}';
          input.required = true;

          const button = create('button');
          button.className = 'jb_button';
          button.innerText = 'Join';

          if (isDark) {
            button.style.color = background;
          }

          form.addEventListener('submit', e => {
            e.preventDefault();
            button.classList.add('loading');
            button.innerText = '...';

            const url = `${baseUrl}/blocks/email-subscribe/emailoctopus`;
            client.post(url, {formId: globalEmailSubscribeBlock.id, email: input.value}, response => {
              if (globalEmailSubscribeBlock.settings.onCompleteType === 'show message') {
                form.innerHTML = `<p>${globalEmailSubscribeBlock.settings.onCompleteMessage}</p>`;
              } else if (globalEmailSubscribeBlock.settings.onCompleteType === 'redirect') {
                window.location.href = globalEmailSubscribeBlock.settings.onCompleteRedirectUrl;
              } else if (globalEmailSubscribeBlock.settings.onCompleteType === 'hide form') {
                form.style.visibility = 'hidden';
              }

              button.classList.remove('loading');
            });
          });

          form.append(input);
          form.append(button);
          container.append(form);
          elementBefore.parentNode.insertBefore(container, elementBefore.nextSibling);

          if (typeof addSettingsButtons === 'function' && localStorage.getItem('jolt_mode') === 'edit' && mode !== 'preview') {
            addSettingsButtons();
          }
        } else {
          retryAttempt++;
          setTimeout(this.addEmailSubscribeForm, 500);
        }
      }

      openTooltip() {
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.classList.add('show');
        tooltipIsOpen = true;
      }

      closeTooltip() {
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        const settingsOverlays = document.querySelectorAll('.jb_settings-overlay');

        if (settingsOverlays) {
          for (let i = 0; i < settingsOverlays.length; i++) {
            settingsOverlays[i].classList.remove('show');
          }
          settingsIsOpen = false;
        }

        tooltipContainer.classList.remove('show');
        tooltipContainer.classList.remove('settings');
        tooltipIsOpen = false;
        tooltipContainer.querySelector('iframe').src = `${iframeBaseUrl}/blocks/tooltips/add`;
      }
    }

    // Listener for window.parent.postMessage() from React web app's iframe
    window.addEventListener('message', event => {
      if (event && event.data && event.data.type) {
        if (event.data.type === 'enable comments') {
          const elementSelector = settingsIsOpen ? null : uniqueSelector(lastHoveredElement.target);
          window.Jolt.enableBlock('comments', elementSelector);
        } else if (event.data.type === 'enable email subscribe') {
          const elementSelector = settingsIsOpen ? null : uniqueSelector(lastHoveredElement.target);
          window.Jolt.enableBlock('email subscribe', elementSelector, event.data.data);
        }

        if (event.data.type === 'disable comments') {
          window.Jolt.disableBlock('comments');
        } else if (event.data.type === 'disable email subscribe') {
          window.Jolt.disableBlock('email subscribe');
        }

        if (event.data.type === 'tooltip settings') {
          const tooltipContainer = document.querySelector('.jb_tooltip-container');
          tooltipContainer.classList.add('settings');
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
    window.Jolt.getBlocks();
  }

  function watchAnalytics() {
    if (window.Jolt.pendingId) {
      if (!socket.connected) {
        setTimeout(watchAnalytics, 100);
      }

      socket.emit('pageview', window.Jolt.pendingId);
    }
  }

  function addSettingsButtons() {
    const blocks = document.querySelectorAll('.jb_block-container');

    if (!blocks) {
      setTimeout(addSettingsButtons, 500);
      return;
    }

    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].querySelector('.jb_settings-overlay')) {
        return;
      }

      const settingsOverlay = create('div');
      settingsOverlay.className = 'jb_settings-overlay';

      const label = create('label');
      label.className = 'jb_settings-label';
      label.innerText = blocks[i].dataset.type;

      blocks[i].append(settingsOverlay);
      blocks[i].append(label);

      // TODO: Change to show settings tooltip
      settingsOverlay.addEventListener('click', e => {
        const settingsOverlays = document.querySelectorAll('.jb_settings-overlay');

        if (settingsOverlays) {
          for (let i = 0; i < settingsOverlays.length; i++) {
            settingsOverlays[i].classList.remove('show')
          }
        }

        const tooltipContainer = document.querySelector('.jb_tooltip-container');

        tooltipContainer.querySelector('iframe').contentWindow.postMessage({
          type: 'settings',
          data: {
            blockType: blocks[i].dataset.type,
          },
        }, '*');

        e.target.classList.add('show');
        const elementOffset = offset(e.target);
        window.Jolt.openTooltip();
        tooltipContainer.style.bottom = `${(window.innerHeight - elementOffset.top) - elementOffset.height + 42}px`;
        tooltipContainer.style.left = `${elementOffset.left + elementOffset.width / 2}px`;
        tooltipContainer.classList.add('settings');
        settingsIsOpen = true;
      });
    }
  }

  //====== EDIT ======//
  function startEditMode() {
    removeAll();
    createInsertLine();
    createTooltipIframe();
    createToolbar();
    addSettingsButtons();
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
      if (tooltipIsOpen && e.target.className && typeof e.target.className.indexOf === 'function' && e.target.className.indexOf('jb_') < 0) {
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
        tooltipContainer.style.bottom = `${(window.innerHeight - elementOffset.top) - elementOffset.height + 8}px`;
        tooltipContainer.style.left = `${elementOffset.left + elementOffset.width / 2}px`;
      });

      document.body.append(line);
    }

    function moveInsertLine(e, isScroll) {
      if (tooltipIsOpen && !isScroll) {
        return;
      }

      if (tooltipIsOpen && !settingsIsOpen) {
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
      if (tooltipIsOpen && !settingsIsOpen) {
        const button = document.querySelector('.jb_plus-icon');
        const elementOffset = offset(button);
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.style.bottom = `${(window.innerHeight - elementOffset.top) - (elementOffset.height) + 8}px`;
        tooltipContainer.style.left = `${elementOffset.left + elementOffset.width / 2}px`;
      } else if (tooltipIsOpen && settingsIsOpen) {
        const block = document.querySelector('.jb_settings-overlay.show');
        const elementOffset = offset(block);
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.style.bottom = `${(window.innerHeight - elementOffset.top) - (elementOffset.height) + 42}px`;
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
