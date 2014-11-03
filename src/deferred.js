define([
	"./core",
	"./var/slice",
	"./callbacks"
], function( jQuery, slice ) {

function Identity( v ) {
	return v;
}
function Thrower( ex ) {
	throw ex;
}

jQuery.extend({

	Deferred: function( func ) {
		var tuples = [
				// action, add listener, callback list, .then list, final state
				[ "resolve", "done", jQuery.Callbacks("once memory"),
					jQuery.Callbacks("once memory"), "resolved" ],
				[ "reject", "fail", jQuery.Callbacks("once memory"),
					jQuery.Callbacks("once memory"), "rejected" ],
				[ "notify", "progress", jQuery.Callbacks("memory") ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				then: function( fnDone, fnFail, fnProgress ) {
					var resolved;

					function thenCallback( deferred, callback, bound ) {
						return function( value ) {
							var fn = function() {
								var returned, then;

								if ( resolved !== bound ) {
									return;
								}

								try {
									returned = callback( value );
									then = returned &&
										// Support: Promises/A+ 2.3.4
										// 2. Requirements
										//    3. The Promise Resolution Procedure
										//       (`[[Resolve]](promise, x)`)
										//       4. If `x` is not an object or function, fulfill
										//          `promise` with `x`.
										( typeof returned === "object" ||
											typeof returned === "function" ) &&
										returned.then;

									// Support: Promises/A+ 2.3.1
									// 2. Requirements
									//    3. The Promise Resolution Procedure
									//       (`[[Resolve]](promise, x)`)
									//       1. If `promise` and `x` refer to the same object,
									//          reject `promise` with a `TypeError` as the reason.
									if ( returned === deferred.promise() ) {
										throw new TypeError();
									}

									if ( jQuery.isFunction( then ) ) {
										resolved = returned;
										then.call(
											returned,
											thenCallback( deferred, Identity, returned ),
											thenCallback( deferred, Thrower, returned )
										);
									} else {
										deferred.resolve( returned );
									}
								} catch ( e ) {

									// Support: Promises/A+ 2.3.3.iii.d.a
									// 2. Requirements
									//    3. The Promise Resolution Procedure
									//       (`[[Resolve]](promise, x)`)
									//       3. Otherwise, if `x` is an object or function,
									//          iii. If `then` is a function, call it with `x` as
									//               `this`, first argument `resolvePromise`, and
									//               second argument `rejectPromise`, where:
									//               d. If calling `then` throws an exception `e`,
									//                  a. If `resolvePromise` or `rejectPromise`
									//                     have been called, ignore it.
									if ( resolved === bound || resolved === returned ) {
										deferred.reject( e );
									}
								}
							};
							if ( bound ) {
								fn();
							} else {
								setTimeout(fn);
							}
						};
					}

					return jQuery.Deferred(function( newDefer ) {
						tuples[ 0 ][ 3 ].add(
							thenCallback( newDefer, jQuery.isFunction( fnDone ) ?
								fnDone :
								Identity
							)
						);
						tuples[ 1 ][ 3 ].add(
							thenCallback( newDefer, jQuery.isFunction( fnFail ) ?
								fnFail :
								Thrower
							)
						);
						deferred.progress(function() {
							var fn = jQuery.isFunction( fnProgress ) && fnProgress,
								returned = fn && fn.apply( this, arguments );
							if ( returned && jQuery.isFunction( returned.promise ) ) {
								returned.promise().progress( newDefer.notify );
							} else {
								newDefer.notifyWith(
									this === promise ? newDefer.promise() : this,
									fn ? [ returned ] : arguments
								);
							}
						});
					}).promise();
				},
				catch: function( fnFail ) {
					return promise.then( null, fnFail );
				},
				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 4 ];

			// promise[ done | fail | progress ] = list.add
			promise[ tuple[1] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(
					function() {
						// state = [ resolved | rejected ]
						state = stateString;
					},

					// [ reject_list | resolve_list ].disable; progress_list.lock
					tuples[ i ^ 1 ][ 2 ].disable, tuples[ 2 ][ 2 ].lock,

					// fire .then callbacks first
					tuple[ 3 ].fire
				);
			}

			// deferred[ resolve | reject | notify ]
			deferred[ tuple[0] ] = function() {
				deferred[ tuple[0] + "With" ]( this === deferred ? promise : this, arguments );
				return this;
			};
			deferred[ tuple[0] + "With" ] = list.fireWith;
		});

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( subordinate /* , ..., subordinateN */ ) {
		var i = 0,
			resolveValues = slice.call( arguments ),
			length = resolveValues.length,

			// the count of uncompleted subordinates
			remaining = length !== 1 ||
				( subordinate && jQuery.isFunction( subordinate.promise ) ) ? length : 0,

			// the master Deferred.
			// If resolveValues consist of only a single Deferred, just use that.
			deferred = remaining === 1 ? subordinate : jQuery.Deferred(),

			// Update function for both resolve and progress values
			updateFunc = function( i, contexts, values ) {
				return function( value ) {
					contexts[ i ] = this;
					values[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( values === progressValues ) {
						deferred.notifyWith( contexts, values );
					} else if ( !( --remaining ) ) {
						deferred.resolveWith( contexts, values );
					}
				};
			},

			progressValues, progressContexts, resolveContexts;

		// Add listeners to Deferred subordinates; treat others as resolved
		if ( length > 1 ) {
			progressValues = new Array( length );
			progressContexts = new Array( length );
			resolveContexts = new Array( length );
			for ( ; i < length; i++ ) {
				if ( resolveValues[ i ] && jQuery.isFunction( resolveValues[ i ].promise ) ) {
					resolveValues[ i ].promise()
						.done( updateFunc( i, resolveContexts, resolveValues ) )
						.fail( deferred.reject )
						.progress( updateFunc( i, progressContexts, progressValues ) );
				} else {
					--remaining;
				}
			}
		}

		// If we're not waiting on anything, resolve the master
		if ( !remaining ) {
			deferred.resolveWith( resolveContexts, resolveValues );
		}

		return deferred.promise();
	}
});

return jQuery;
});
