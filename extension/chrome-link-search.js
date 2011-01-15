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
                position: 'fixed',
                top: '0',
                right: '0',
                zIndex: '2147483647'
            },
            CONTENT_BOX: {
                background: '#DDD',
                padding: '5px 10px',
                border: '1px solid #CCC',
                borderBottomLeftRadius: '10px',
                display: 'block',
                float: 'right',
                width: 'auto',
                height: 'auto'
            },
            LABEL : {
                color: '#444',
                fontSize: '12px'
            },
            FIELD : {
                fontSize: '12px',
                marginLeft: '5px',
                borderRadius: '5px',
                color: '#000',
                border: '1px solid #BBB',
                padding: '6px 8px'
            },
            MASK : {
                background: '#000',
                opacity: '0.25'
            },
            MATCH : {
                background: 'yellow'
            }
        };


    function LinkSearch (config) {
        LinkSearch.superclass.constructor.apply(this, arguments);
    }

    LinkSearch.NAME = 'linkSearch';

    LinkSearch.LABEL_TEMPLATE = '<label for="chrome-link-search-field">{LABEL}</label>';
    LinkSearch.FIELD_TEMPLATE = '<input id="chrome-linksearch-field" type="text"></input>';
    LinkSearch.MASK_TEMPLATE  = '<div id="chrome-linksearch-mask"></div>';

    LinkSearch.ATTRS = {

        strings: {
            value: {
                label: 'Quick Find (links only):'
            }
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
                field = Y.Node.create(LinkSearch.FIELD_TEMPLATE);

            // Set style attributes.
            boundingBox.setStyles(styles.BOUNDING_BOX);
            contentBox.setStyles(styles.CONTENT_BOX);
            label.setStyles(styles.LABEL);
            field.setStyles(styles.FIELD);

            // Define styles for hidden state and matched links.
            var boundingBoxId = '#' + boundingBox.get('id'),
                hiddenClass   = '.' + this.getClassName('hidden'),
                hiddenRule    = boundingBoxId + hiddenClass + '{display:none;}',
                matchRule     = '.' + this.getClassName('match') + '{background:yellow;}',
                styleTag      = '<style>' + hiddenRule + matchRule + '</style>';

            Y.one('head').append(
                Y.Node.create(styleTag)
            );

            contentBox.appendChild(label);
            contentBox.appendChild(field);

            this.field = field;
        },

        bindUI : function() {
            Body.on('linksearch|keyup',   Y.bind(this._triggerFilter, this));
            Body.on('linksearch|keydown', Y.bind(this._triggerFilter, this));

            this.field.on('keyup', Y.bind(this._searchModeKeyUpHandler, this));

            this.after('searchModeChange',   Y.bind(this._afterSearchModeChange,   this));
            this.after('queryStringChange',  Y.bind(this._afterQueryStringChange,  this));
            this.after('matchedLinksChange', Y.bind(this._afterMatchedLinksChange, this));
            this.after('focusIndexChange',   Y.bind(this._afterFocusIndexChange,   this));
        },

        syncUI : function() {
            this.set('visible', this.get('searchMode'));
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
                this.set('visible', true);
                this.set('allLinks', Y.all('a'));
                this.field.focus();

                Body.on('searchmode|keydown', Y.bind(this._searchModeKeyDownHandler, this));
            }
            else {
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
                links[i][add ? 'addClass' : 'removeClass']('yui3-linksearch-match');
            }
        },

    });

    Y.LinkSearch = LinkSearch;

});
