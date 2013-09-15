define( [
            'dojo/_base/declare',
            'dojo/dom-construct',
            'dojo/dom-class',
            'JBrowse/View/Track/BlockBased',
            'JBrowse/View/Track/ExportMixin',
            'JBrowse/CodonTable',
            'JBrowse/Util'
        ],
        function( declare, dom, domClass, BlockBased, ExportMixin, CodonTable, Util ) {

return declare( [BlockBased, ExportMixin],
 /**
  * @lends JBrowse.View.Track.Sequence.prototype
  */
{
    /**
     * Track to display the underlying reference sequence, when zoomed in
     * far enough.
     *
     * @constructs
     * @extends JBrowse.View.Track.BlockBased
     */
    constructor: function( args ) {
        this._charMeasurements = {};
    },

    _defaultConfig: function() {
        return {
            maxExportSpan: 500000,
            showForwardStrand: true,
            showReverseStrand: true,
            showTranslation: true
        };
    },
    _exportFormats: function() {
        return [{name: 'FASTA', label: 'FASTA', fileExt: 'fasta'}];
    },

    endZoom: function(destScale, destBlockBases) {
        this.clear();
    },

    setViewInfo:function(genomeView, heightUpdate, numBlocks,
                         trackDiv,
                         widthPct, widthPx, scale) {
        this.inherited( arguments );
        this.show();
    },

    nbsp: String.fromCharCode(160),

    fillBlock:function( args ) {

        var blockIndex = args.blockIndex;
        var block = args.block;
        var leftBase = args.leftBase;
        var rightBase = args.rightBase;
        var scale = args.scale;

        var leftExtended = leftBase - 2;
        var rightExtended = rightBase + 2;

        var charSize = this.getCharacterMeasurements('sequence');

        // if we are zoomed in far enough to draw bases, then draw them
        if ( scale >= 1 ) {
            this.store.getReferenceSequence(
                {
                    ref: this.refSeq.name,
                    seqChunkSize: this.refSeq.seqChunkSize,
                    start: leftExtended,
                    end: rightExtended
                },
                dojo.hitch( this, '_fillSequenceBlock', block, scale ),
                function() {}
            );
            this.heightUpdate( this.config.showTranslation ? (charSize.h + 2)*8 : charSize.h*2, blockIndex );
        }
        // otherwise, just draw a sort of line (possibly dotted) that
        // suggests there are bases there if you zoom in far enough
        else {
            var borderWidth = Math.max(1,Math.round(4*scale/charSize.w));
            var blur = dojo.create( 'div', {
                             className: 'sequence_blur',
                             style: { borderStyle: 'solid', borderTopWidth: borderWidth+'px', borderBottomWidth: borderWidth+'px' }
                         }, block.domNode );
            this.heightUpdate( blur.offsetHeight+2*blur.offsetTop, blockIndex );
        }

        args.finishCallback();
    },

    _fillSequenceBlock: function( block, scale, seq ) {
        seq = seq.replace(/\s/g,this.nbsp);

        var blockStart = block.startBase;
        var blockEnd = block.endBase;
        var blockSeq = seq.substring( 2, seq.length - 2 );
        var blockLength = blockSeq.length;

        var extStart = blockStart-2;
        var extEnd = blockStart+2;
        var extStartSeq = seq.substring( 0, seq.length - 2 );
        var extEndSeq = seq.substring( 2 );

        if( this.config.showForwardStrand && this.config.showTranslation ) {
            var frameDiv = [];
            for( var i = 0; i < 3; i++ ) {
                var transStart = blockStart + i;
                var frame = (transStart % 3 + 3) % 3;
                var translatedDiv = this._renderTranslation( extEndSeq, i, blockStart, blockEnd, blockLength, scale );
                frameDiv[frame] = translatedDiv;
                domClass.add( translatedDiv, "frame" + frame );
            }
            for( var i = 2; i >= 0; i-- ) {
                block.domNode.appendChild( frameDiv[i] );
            }
        }

        // make a div to contain the sequences
        if( this.config.showReverseStrand || this.config.showForwardStrand )
            var seqNode = dom.create("div", { className: "sequence", style: { width: "100%"} }, block.domNode);

        // add a div for the forward strand
        if( this.config.showForwardStrand )
            seqNode.appendChild( this._renderSeqDiv( blockStart, blockEnd, blockSeq, scale ));

        // and one for the reverse strand
        if( this.config.showReverseStrand ) {
            var comp = this._renderSeqDiv( blockStart, blockEnd, Util.complement(blockSeq), scale );
            comp.className = 'revcom';
            seqNode.appendChild( comp );

            if( this.config.showTranslation ) {
                var frameDiv = [];
                for(var i = 0; i < 3; i++) {
                    var transStart = blockStart + 1 - i;
                    var frame = (transStart % 3 + 3) % 3;
                    var translatedDiv = this._renderTranslation( extStartSeq, i, blockStart, blockEnd, blockLength, scale, true );
                    frameDiv[frame] = translatedDiv;
                    domClass.add( translatedDiv, "frame" + frame );
                }
                for( var i = 0; i < 3; i++ ) {
                    block.domNode.appendChild( frameDiv[i] );
                }
            }
        }
    },

    _renderTranslation: function( seq, offset, blockStart, blockEnd, blockLength, scale, reverse ) {
        seq = reverse ? Util.revcom( seq ) : seq;

        var extraBases = (seq.length - offset) % 3;
        var seqSliced = seq.slice( offset, seq.length - extraBases );

        var translated = "";
        for( var i = 0; i < seqSliced.length; i += 3 ) {
            var nextCodon = seqSliced.slice(i, i + 3);
            var aa = CodonTable[nextCodon] || this.nbsp;
            translated = translated + aa;
        }

        translated = reverse ? translated.split("").reverse().join("") : translated; // Flip the translated seq for left-to-right rendering

        var charSize = this.getCharacterMeasurements("aa");

        var charWidth = 100/(blockLength / 3);

        var container  = dom.create('div',
            {
                className: 'translatedSequence offset'+offset,
                style:
                {
                    width: (charWidth * translated.length) + "%"
                }
            });

        if( reverse ) {
            container.style.top = this.config.showForwardStrand ? "32px" : '16px';
            container.style.left = (100 - charWidth * (translated.length + offset / 3))+ "%";
        } else {
            container.style.left = (charWidth * offset / 3) + "%";
        }

        charWidth = 100/ translated.length + "%";

        var drawChars = scale >= charSize.w;

        for( var i=0; i<translated.length; i++ ) {
            var aaSpan = document.createElement('div');
            aaSpan.className = 'aa aa_'+translated.charAt([i]).toLowerCase();
            aaSpan.style.width = charWidth;
            if( drawChars ) {
                aaSpan.className = aaSpan.className + ' big';
                aaSpan.innerHTML = translated.charAt([i]);
            }
            container.appendChild(aaSpan);
        }
        return container;
    },

    /**
     * Given the start and end coordinates, and the sequence bases,
     * makes a div containing the sequence.
     * @private
     */
    _renderSeqDiv: function ( start, end, seq, scale ) {

        var charSize = this.getCharacterMeasurements('sequence');

        var container  = document.createElement('div');
        var charWidth = 100/(end-start)+"%";
        var drawChars = scale >= charSize.w;
        var bigTiles = scale > charSize.w + 4; // whether to add .big styles to the base tiles
        for( var i=0; i<seq.length; i++ ) {
            var base = document.createElement('span');
            base.className = 'base base_'+seq.charAt([i]).toLowerCase();
            base.style.width = charWidth;
            if( drawChars ) {
                if( bigTiles )
                    base.className = base.className + ' big';
                base.innerHTML = seq.charAt(i);
            }
            container.appendChild(base);
        }
        return container;
    },

    /**
     * @returns {Object} containing <code>h</code> and <code>w</code>,
     *      in pixels, of the characters being used for sequences
     */
    getCharacterMeasurements: function( className ) {
        return this._charMeasurements[className] || (
            this._charMeasurements[className] = this._measureSequenceCharacterSize( this.div, className )
        );
    },

    /**
     * Conducts a test with DOM elements to measure sequence text width
     * and height.
     */
    _measureSequenceCharacterSize: function( containerElement, className ) {
        var widthTest = document.createElement("div");
        widthTest.className = className;
        widthTest.style.visibility = "hidden";
        var widthText = "12345678901234567890123456789012345678901234567890";
        widthTest.appendChild(document.createTextNode(widthText));
        containerElement.appendChild(widthTest);
        var result = {
            w:  widthTest.clientWidth / widthText.length,
            h: widthTest.clientHeight
        };
        containerElement.removeChild(widthTest);
        return result;
  },

    _trackMenuOptions: function() {
        var track = this;
        var o = this.inherited(arguments);
        o.push( { type: 'dijit/MenuSeparator' } );
        o.push.apply( o,
            [
                { label: 'Show forward strand',
                  type: 'dijit/CheckedMenuItem',
                  checked: !! this.config.showForwardStrand,
                  onClick: function(event) {
                      track.config.showForwardStrand = this.checked;
                      track.changed();
                  }
                },
                { label: 'Show reverse strand',
                  type: 'dijit/CheckedMenuItem',
                  checked: !! this.config.showReverseStrand,
                  onClick: function(event) {
                      track.config.showReverseStrand = this.checked;
                      track.changed();
                  }
                },
                { label: 'Show translation',
                  type: 'dijit/CheckedMenuItem',
                  checked: !! this.config.showTranslation,
                  onClick: function(event) {
                      track.config.showTranslation = this.checked;
                      track.changed();
                  }
                }
            ]);
        return o;
    }

});
});
