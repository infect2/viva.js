    var Quadtree = function ( bound ) {
        this.root = new QuadNode( 0, bound );
        this.bound = bound;
    };

    Quadtree.prototype.insert = function ( body ) {
        this.root.insert( body );
    };

    Quadtree.prototype.retrieve = function ( body ) {
        return this.root.retrieve( body );
    };

    Quadtree.prototype.clear = function () {
        this.root.clear();
    };

    var QuadNode = function ( level, bound ) {
        this.max_objects = 10;
        this.max_level = 5;
        this.bodies = [];
        this.children = [];
        this.residue = [];
        this.aabb = bound || new viva.AABB();
        this.level = level;
    };

    QuadNode.TOP_LEFT = 0;
    QuadNode.TOP_RIGHT = 1;
    QuadNode.BOTTOM_RIGHT = 2;
    QuadNode.BOTTOM_LEFT = 3;

    QuadNode.prototype.split = function () {
        var width = this.aabb.width/2,
            height = this.aabb.height/2,
            x = this.aabb.x,
            y = this.aabb.y;

        this.children[0] = QuadNodePool.allocate( this.level + 1, x, y, width, height );// new QuadNode( this.level + 1, new viva.AABB( x, y, width, height ) );
        this.children[1] = QuadNodePool.allocate( this.level + 1, x + width, y, width, height );// new QuadNode( this.level + 1, new viva.AABB( x + width, y, width, height ) );
        this.children[2] = QuadNodePool.allocate( this.level + 1, x + width, y + height, width, height );// new QuadNode( this.level + 1, new viva.AABB( x + width, y + height, width, height ) );
        this.children[3] = QuadNodePool.allocate( this.level + 1, x, y + height, width, height );// new QuadNode( this.level + 1, new viva.AABB( x, y + height, width, height ) );
    };

    QuadNode.prototype.findIndex = function ( body ) {
        if ( !body ) {
            return;
        }

        var bodyIsInTopHalf = body.position.y < this.aabb.y + this.aabb.height/2,
            bodyIsInBottomHalf = !bodyIsInTopHalf,
            bodyIsInLeftHalf = body.position.x < this.aabb.x + this.aabb.width/2,
            bodyIsInRightHalf = !bodyIsInLeftHalf;

        if ( bodyIsInTopHalf && bodyIsInLeftHalf ) {
            return QuadNode.TOP_LEFT;
        }
        if ( bodyIsInTopHalf && bodyIsInRightHalf ) {
            return QuadNode.TOP_RIGHT;
        }
        if ( bodyIsInBottomHalf && bodyIsInLeftHalf ) {
            return QuadNode.BOTTOM_LEFT;
        }
        if ( bodyIsInBottomHalf && bodyIsInRightHalf ) {
            return QuadNode.BOTTOM_RIGHT;
        }
    };

    // QuadNode.prototype._checkOverlap = function ( body, index ) {
    //     var right, left, top, bottom;
    //     switch ( index ) {
    //         case 0:
    //             left = this.aabb.x;
    //             right = this.aabb.x + this.aabb.width/2;
    //             top = this.aabb.y;
    //             bottom = this.aabb.

    //     }
    //     return ( ( this.right >= body.left && this.right <= body.right ) || ( body.right >= this.left && body.right <= this.right ) ) &&
    //             ( ( this.bottom >= body.top && this.bottom <= body.bottom ) || ( body.bottom >= this.top && body.bottom <= this.bottom ) );
    // }

    QuadNode.prototype.insert = function ( body ) {
        if ( this.bodies.length <= this.max_objects && this.children.length === 0 ) {
            this.bodies.push( body );
            return;
        }

        var index, i, len;
        if ( this.bodies.length > this.max_objects ) {
            this.bodies.push( body );
            this.split();

            i = 0;
            len = this.bodies.length;

            for ( i = 0; i < len; i++ ) {
                body = this.bodies.pop();
                index = this.findIndex( body );
                this.children[ index ].insert( body );
            }

            return;
        }

        if ( this.children.length > 0 ) {
            index = this.findIndex( body );
            var child = this.children[ index ];
            if ( child.aabb.contains( body.aabb ) ) {
                child.insert( body );
            } else {
                this.residue.push( body );
            }
        }
    };

    QuadNode.prototype.retrieve = function ( body ) {
        var index = this.findIndex( body ),
            result = [];

        if ( this.children.length > 0 && index >= 0 ){
            if ( this.children[ index ].aabb.contains( body.aabb ) ) {
                Array.prototype.push.apply( result, this.children[ index ].retrieve( body ) );
            } else {

                if ( body.aabb.x <= this.children[ QuadNode.TOP_RIGHT ].aabb.x ) {
                    if ( body.aabb.y <= this.children[ QuadNode.BOTTOM_LEFT ].aabb.y ) {
                        Array.prototype.push.apply( result, this.children[ QuadNode.TOP_LEFT ].retrieve( body ) );
                    }

                    if ( body.aabb.y + body.aabb.height > this.children[ QuadNode.BOTTOM_LEFT ].aabb.y) {
                        Array.prototype.push.apply( result, this.children[ QuadNode.BOTTOM_LEFT ].retrieve( body ) );
                    }
                }

                if ( body.aabb.x + body.aabb.width > this.children[ QuadNode.TOP_RIGHT ].aabb.x) {//position+width bigger than middle x
                    if ( body.aabb.y <= this.children[ QuadNode.BOTTOM_RIGHT ].aabb.y) {
                        Array.prototype.push.apply( result, this.children[ QuadNode.TOP_RIGHT ].retrieve( body ) );
                    }

                    if ( body.aabb.y + body.aabb.height > this.children[ QuadNode.BOTTOM_RIGHT ].aabb.y ) {
                        Array.prototype.push.apply( result, this.children[ QuadNode.BOTTOM_RIGHT ].retrieve( body ) );
                    }
                }
            }
        }

        Array.prototype.push.apply( result, this.bodies );
        Array.prototype.push.apply( result, this.residue );

        return result;
    };

    QuadNode.prototype.clear = function () {
        this.bodies = [];
        this.residue = [];

        if (this.children.length > 0 ) {
            this.children[ 0 ].clear();
            this.children[ 1 ].clear();
            this.children[ 2 ].clear();
            this.children[ 3 ].clear();
            QuadNodePool.release( this.children[ 0 ] );
            QuadNodePool.release( this.children[ 1 ] );
            QuadNodePool.release( this.children[ 2 ] );
            QuadNodePool.release( this.children[ 3 ] );
            this.children = [];
        }
    };

    var QuadNodePool = {};

    var nodecnt = window.nodecnt = 0;
    QuadNodePool.pool = [];
    QuadNodePool.size = 16;
    QuadNodePool.allocate = function ( level, x, y, width, height ) {
        if ( QuadNodePool.pool.length === 0 ) {
            QuadNodePool.expand();
        }
        var node = QuadNodePool.pool.pop();

        node.aabb.set( x, y, width, height );
        node.level = level;

        nodecnt++;
        return node;
    };

    QuadNodePool.expand = function () {
        for ( var i = 0; i < QuadNodePool.size; i++ ) {
            QuadNodePool.pool.push( new QuadNode( -1 ) );
        }
    };

    QuadNodePool.release = function( node ) {
        nodecnt--;
        QuadNodePool.pool.push( node );
    };

    viva.Quadtree = Quadtree;

