YUI.add('chrome-link-search', function (Y) {

    var Body = Y.one('body'),

        keyCodeFor = {
            ESC: 27,
            SINGLE_QUOTE: 222,
            G: 71
        },

        // Search mode is not initiated if the trigger originates from one of these elements.
        isInvalidTriggerSource = {
            INPUT: true,
            TEXTAREA: true
        },

        styles = {
            BOUNDING_BOX : {
                border: '1px solid #CCC',
                borderBottomLeftRadius: '10px',
                background: '#DDD',
                position: 'fixed',
                top: '0',
                right: '0',
                zIndex: '2147483647'
            },
            CONTENT_BOX: {
                padding: '5px 7px',
                display: 'block',
                width: 'auto',
                height: 'auto'
            },
            LABEL : {
                color: '#444',
                fontSize: '13px'
            },
            FIELD : {
                fontSize: '12px',
                marginLeft: '7px',
                borderRadius: '5px',
                color: '#000',
                border: '1px solid #BBB',
                padding: '3px 5px'
            },
            CLOSE : {
                height: '16px',
                width: '16px',
                display: 'inline',
                float: 'right',
                position: 'relative',
                margin: '3px 0 0 5px',
                borderRadius: '10px'
            },
            CLOSE_BOTH : {
                height: '13px',
                width: '2px',
                display: 'block',
                background: '#000',
            },
            CLOSE_FORWARD : {
                transform: 'rotate(45deg)',
                position: 'absolute',
                top: '1px',
                right: '7px'
            },
            CLOSE_BACK : {
                transform: 'rotate(90deg)'
            }
        };


    function LinkSearch (config) {
        LinkSearch.superclass.constructor.apply(this, arguments);
    }

    LinkSearch.NAME = 'linkSearch';

    LinkSearch.LABEL_TEMPLATE = '<label for="linksearch-field">{LABEL}</label>';
    LinkSearch.FIELD_TEMPLATE = '<input id="linksearch-field" type="text"></input>';

    LinkSearch.CLOSE_TEMPLATE         = '<span id="linksearch-close"></span>';
    LinkSearch.CLOSE_FORWARD_TEMPLATE = '<span id="linksearch-forwardslash"></span>';
    LinkSearch.CLOSE_BACK_TEMPLATE    = '<span id="linksearch-backslash"></span>';

    LinkSearch.CSS = '<style type="text/css">' +
        '.linksearch-match{background:{BACKGROUND_COLOR};}' +
        '#linksearch-close:hover {background:#777}' +
        '#linksearch-close:hover span {background:#fff !important;}' +
    '</style>';

    LinkSearch.ATTRS = {

        strings: {
            value: {
                label: 'Quick Find (links only):'
            }
        },

        matchColor: {
            value: 'yellow'
        },

        searchMode: {
            value: false,
            broadcast: 1,
        },

        queryString: {
            value: '',
            broadcast: 1,
        },

        // caches matching links (property: link text, value: array of matched links)
        matchCache: {
            value: {},
        },

        matchedLinks: {
            value: [],
            broadcast: 1,
        },

        numMatchedLinks: {
            value: 0,
        },

        // matchedLinks index of the focused link
        focusIndex: {
            value: null,
            broadcast: 1,
        },

        // NodeList snapshot of all links
        allLinks: {
            value: null,
        },

        lastActiveElement: {
            value: null,
        },
    };


    Y.extend(LinkSearch, Y.Widget, {

        destructor : function() {
            Y.detach('linksearch|*');
        },

        renderUI : function() {

            var boundingBox = this.get('boundingBox'),
                contentBox  = this.get('contentBox'),
                labelText   = this.getString('label'),

                label = Y.Node.create(Y.substitute(LinkSearch.LABEL_TEMPLATE, { LABEL: labelText })),
                field = Y.Node.create(LinkSearch.FIELD_TEMPLATE),

                close   = Y.Node.create(LinkSearch.CLOSE_TEMPLATE),
                forward = Y.Node.create(LinkSearch.CLOSE_FORWARD_TEMPLATE),
                back    = Y.Node.create(LinkSearch.CLOSE_BACK_TEMPLATE);

            // Set style attributes.
            boundingBox.setStyles(styles.BOUNDING_BOX);
            contentBox.setStyles(styles.CONTENT_BOX);
            label.setStyles(styles.LABEL);
            field.setStyles(styles.FIELD);
            close.setStyles(styles.CLOSE);
            forward.setStyles(styles.CLOSE_BOTH);
            forward.setStyles(styles.CLOSE_FORWARD);
            back.setStyles(styles.CLOSE_BOTH);
            back.setStyles(styles.CLOSE_BACK);

            Y.one('head').append(
                Y.Node.create(
                    Y.substitute(LinkSearch.CSS, {
                        BACKGROUND_COLOR: this.get('matchColor')
                    })
                )
            );

            contentBox.appendChild(label);
            contentBox.appendChild(field);

            forward.append(back);
            close.append(forward);
            contentBox.append(close);

            this.field = field;
            this.close = close;
        },

        bindUI : function() {
            Body.on('linksearch|keyup',   Y.bind(this._triggerFilter, this));
            Body.on('linksearch|keydown', Y.bind(this._triggerFilter, this));

            this.field.on('keyup', Y.bind(this._searchModeKeyUpHandler, this));
            this.close.on('click', Y.bind(function () {
                this.set('searchMode', false);
            }, this));

            this.after('searchModeChange',   Y.bind(this._afterSearchModeChange,   this));
            this.after('queryStringChange',  Y.bind(this._afterQueryStringChange,  this));
            this.after('matchedLinksChange', Y.bind(this._afterMatchedLinksChange, this));
            this.after('focusIndexChange',   Y.bind(this._afterFocusIndexChange,   this));
        },

        syncUI : function() {
            this.get('boundingBox').remove();
        },

        _triggerFilter : function (e) {
            var triggerSearchMode,
                isSingleQuote = e.keyCode === keyCodeFor.SINGLE_QUOTE;

            if (!isSingleQuote) {
                return;
            }

            // Apologies for the double-negative but I wanted default-deny.
            if (!isInvalidTriggerSource[e.target.get('tagName')]) {
                triggerSearchMode = isSingleQuote;
                // Prevent the search field from being initiated with a single quote entry.
                e.preventDefault();
            }
            else {
                triggerSearchMode = e.metaKey && isSingleQuote;
            }

            triggerSearchMode && this._triggerSearchMode();
        },

        // Trigger search mode. Gives search field focus if already in search mode.
        _triggerSearchMode : function () {
            this.set('searchMode', true);
            this.field.focus();
        },

        _searchModeKeyUpHandler : function (e) {
            this.set('queryString', this.field.get('value'));
        },

        _searchModeKeyDownHandler : function (e) {
            if (e.keyCode === keyCodeFor.ESC) {
                this.set('searchMode', false);
                e.halt();
            }
            else if (e.shiftKey && e.metaKey && e.keyCode === keyCodeFor.G) {
                this._incrementFocusLinkIndex('decrement');
                e.halt();
            }
            else if (e.metaKey && e.keyCode === keyCodeFor.G) {
                this._incrementFocusLinkIndex();
                e.halt();
            }
        },

        _incrementFocusLinkIndex : function (decrement) {
            // don't increment/decrement the focus index unless there are matched links
            if (!this.get('numMatchedLinks')) {
                return;
            }

            var focusIndex = this.get('focusIndex'),
                increment  = !decrement;

            // nothing focused yet
            if (focusIndex === null) {
                this.set('focusIndex', 0);
            }
            // increment wrap around
            else if (increment && focusIndex + 1 >= this.get('numMatchedLinks')) {
                this.set('focusIndex', 0);
            }
            // decrement wrap around
            else if (decrement && focusIndex === 0) {
                this.set('focusIndex', this.get('numMatchedLinks') - 1);
            }
            // increment/decrement
            else {
                this.set('focusIndex', increment ? focusIndex + 1 : focusIndex - 1);
            }
        },

        _getMatchingLinks : function (query) {
            if (query === '') {
                return [];
            }

            var cache = this.get('matchCache');

            if (cache[query]) {
                return cache[query];
            }

            var regex = new RegExp(query, 'i'),
                links = this.get('allLinks'),
                matches = [];

            links.each(function (el) {
                var matchesText  = regex.test(el.get('textContent')),
                    inRenderTree = el.get('offsetParent');

                if (matchesText && inRenderTree) {
                    matches.push(el);
                }
            });

            cache[query] = matches;

            return matches;
        },

        _afterSearchModeChange : function (e) {
            var searchModeIsActive = e.newVal;

            if (searchModeIsActive) {
                Body.append(this.get('boundingBox'));
                this.set('visible', true);
                this.set('allLinks', Y.all('a'));
                this.field.focus();

                Body.on('searchmode|keydown', Y.bind(this._searchModeKeyDownHandler, this));
            }
            else {
                this.get('boundingBox').remove();
                this.set('visible', false);
                this.set('allLinks', null);
                this.field.set('value', '');
                this.set('matchCache', {});
                this.set('matchedLinks', []);

                Y.detach('searchmode|*'); // detach all search mode events
            }
        },

        _afterFocusIndexChange : function (e) {
            var index = e.newVal;

            if (index === null) {
                return;
            }

            this.get('matchedLinks')[index].focus();
        },

        _afterQueryStringChange : function (e) {
            this.set('matchedLinks', this._getMatchingLinks(e.newVal));
        },

        _afterMatchedLinksChange : function (e) {
            this._removeHighlighting(e.prevVal || []);
            this._addHighlighting(e.newVal);

            this.set('numMatchedLinks', e.newVal.length);
            this.set('focusIndex', null);

            this._scrollFirstMatchIntoView();
        },


        _scrollFirstMatchIntoView : function () {
            var matched = this.get('matchedLinks');

            if (matched.length) {
                matched[0].focus();
                this.field.focus();
            }
        },

        _addHighlighting : function (links) {
            this._highlighter(links, true);
        },

        _removeHighlighting : function (links) {
            this._highlighter(links, false);
        },

        _highlighter : function (links, add) {
            for (var i = 0, len = links.length; i < len; i++) {
                links[i][add ? 'addClass' : 'removeClass']('linksearch-match');
            }
        },

    });

    Y.LinkSearch = LinkSearch;

});
