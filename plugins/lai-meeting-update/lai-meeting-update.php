<?php
/**
 * Plugin Name: LAI Meeting Update Form
 * Description: A step-by-step form for groups to update their meeting details and officers (Secretary, Treasurer, IGR, GSR), or add a new meeting. Groups find their meeting by typing its name; the list comes from 12 Step Meeting List (read-only, never changed). Submissions are kept private under "Meeting Updates" in the dashboard and emailed to the office. Use the [lai_meeting_update] shortcode.
 * Version: 1.4.3
 * Author: Lancaster Area Intergroup
 * License: GPL-2.0-or-later
 * Text Domain: lai-meeting-update
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LAI_MU_VERSION', '1.4.3' );
define( 'LAI_MU_CPT', 'lai_mtg_update' );

/** Where notices go: Meeting Updates > Settings, else the site's admin email. */
function lai_mu_office_email() {
	$e = get_option( 'lai_mu_office_email', '' );
	return is_email( $e ) ? $e : get_option( 'admin_email' );
}

/* ------------------------------------------------------------------
 * Private storage: "Meeting Updates" in the dashboard
 * ------------------------------------------------------------------ */
add_action( 'init', 'lai_mu_register' );
function lai_mu_register() {
	register_post_type(
		LAI_MU_CPT,
		array(
			'labels'              => array(
				'name'          => 'Meeting Updates',
				'singular_name' => 'Meeting Update',
				'menu_name'     => 'Meeting Updates',
				'all_items'     => 'All Meeting Updates',
				'edit_item'     => 'Meeting Update',
				'search_items'  => 'Search Meeting Updates',
				'not_found'     => 'No meeting updates yet.',
			),
			'public'              => false,
			'publicly_queryable'  => false,
			'exclude_from_search' => true,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'show_in_nav_menus'   => false,
			'show_in_admin_bar'   => false,
			'has_archive'         => false,
			'rewrite'             => false,
			'query_var'           => false,
			'menu_icon'           => 'dashicons-clipboard',
			'menu_position'       => 26,
			'supports'            => array( 'title', 'custom-fields' ),
			'show_in_rest'        => true,
			'rest_base'           => 'lai-meeting-updates',
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'capabilities'        => array( 'create_posts' => 'do_not_allow' ),
		)
	);

	$auth = function () {
		return current_user_can( 'edit_posts' );
	};
	register_post_meta(
		LAI_MU_CPT,
		'lai_mu_data',
		array(
			'type'          => 'string',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => $auth,
			'description'   => 'The submission, as JSON.',
		)
	);
	register_post_meta(
		LAI_MU_CPT,
		'lai_mu_status',
		array(
			'type'          => 'string',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => $auth,
			'description'   => 'new, done, or spam.',
		)
	);

	/* Officers on file, as first name + last initial only. One private item, refreshed from the office's sheet. */
	register_post_type(
		'lai_mu_roster',
		array(
			'label'               => 'Officer initials',
			'public'              => false,
			'publicly_queryable'  => false,
			'exclude_from_search' => true,
			'show_ui'             => false,
			'show_in_rest'        => true,
			'rest_base'           => 'lai-mu-roster',
			'rewrite'             => false,
			'query_var'           => false,
			'supports'            => array( 'title', 'custom-fields' ),
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
		)
	);
	register_post_meta(
		'lai_mu_roster',
		'lai_mu_roster',
		array(
			'type'          => 'string',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => $auth,
			'description'   => 'JSON list of {name, day, time (HH:MM), sec, tre}. Names as first name + last initial only.',
		)
	);
}

/** Normalize a meeting name for matching ("The Grapevine Group" = "grapevine"). */
function lai_mu_norm_name( $s ) {
	$s = strtolower( html_entity_decode( (string) $s, ENT_QUOTES ) );
	$s = str_replace( '&', 'and', $s );
	$s = preg_replace( "/['\x{2019}`.]/u", '', $s );
	$s = preg_replace( '/\b(the|group|grp|aa|meeting)\b/', '', $s );
	return preg_replace( '/[^a-z0-9]/', '', $s );
}

/** Adds sec / tre ("Pat S.") to each meeting from the private initials list. */
function lai_mu_add_roster( $meetings ) {
	$items = get_posts(
		array(
			'post_type'        => 'lai_mu_roster',
			'post_status'      => array( 'private', 'draft', 'publish' ),
			'numberposts'      => 1,
			'orderby'          => 'modified',
			'order'            => 'DESC',
			'suppress_filters' => true,
		)
	);
	if ( ! $items ) {
		return $meetings;
	}
	$list = json_decode( (string) get_post_meta( $items[0]->ID, 'lai_mu_roster', true ), true );
	if ( ! is_array( $list ) ) {
		return $meetings;
	}
	foreach ( $meetings as &$m ) {
		$nm   = lai_mu_norm_name( $m['name'] );
		$hits = array();
		foreach ( $list as $r ) {
			if ( ! is_array( $r ) || empty( $r['name'] ) || empty( $r['day'] ) || strcasecmp( $r['day'], $m['day'] ) !== 0 ) {
				continue;
			}
			$rn = lai_mu_norm_name( $r['name'] );
			if ( '' !== $rn && ( $rn === $nm || false !== strpos( $rn, $nm ) || false !== strpos( $nm, $rn ) ) ) {
				$hits[] = $r;
			}
		}
		if ( count( $hits ) > 1 ) {
			$hits = array_values(
				array_filter(
					$hits,
					function ( $r ) use ( $m ) {
						return isset( $r['time'] ) && $r['time'] === $m['start24'];
					}
				)
			);
		}
		if ( 1 === count( $hits ) ) {
			$m['sec'] = isset( $hits[0]['sec'] ) ? lai_mu_short_name( sanitize_text_field( $hits[0]['sec'] ) ) : '';
			$m['tre'] = isset( $hits[0]['tre'] ) ? lai_mu_short_name( sanitize_text_field( $hits[0]['tre'] ) ) : '';
		}
	}
	unset( $m );
	return $meetings;
}

/* Classic edit screen for these (no block editor). */
add_filter(
	'use_block_editor_for_post_type',
	function ( $use, $type ) {
		return LAI_MU_CPT === $type ? false : $use;
	},
	10,
	2
);

/** The post types that hold officer or submission details. None of them may ever be public. */
function lai_mu_private_types() {
	return array( LAI_MU_CPT, 'lai_mu_roster', 'lai_mu_officers' );
}

/* Never allow these to be published (or scheduled to publish). Applies to REST and connector updates too. */
add_filter(
	'wp_insert_post_data',
	function ( $data ) {
		if ( in_array( $data['post_type'], lai_mu_private_types(), true ) && in_array( $data['post_status'], array( 'publish', 'future' ), true ) ) {
			$data['post_status'] = 'private';
		}
		return $data;
	}
);

/*
 * Second lock: a meta field's auth_callback only controls who can CHANGE it, not who can READ it.
 * So the REST API never shows these items' meta to anyone who can't edit posts, whatever their status.
 */
foreach ( lai_mu_private_types() as $lai_mu_type ) {
	add_filter(
		'rest_prepare_' . $lai_mu_type,
		function ( $response ) {
			if ( ! current_user_can( 'edit_posts' ) && $response instanceof WP_REST_Response ) {
				$data = $response->get_data();
				unset( $data['meta'] );
				$response->set_data( $data );
			}
			return $response;
		}
	);
}
unset( $lai_mu_type );

/** How many submissions are still marked New (not Done, not Spam, not in the trash). */
function lai_mu_new_count() {
	$q = new WP_Query(
		array(
			'post_type'              => LAI_MU_CPT,
			'post_status'            => array( 'private', 'draft', 'pending', 'publish' ),
			'meta_key'               => 'lai_mu_status', // phpcs:ignore WordPress.DB.SlowDBQuery
			'meta_value'             => 'new', // phpcs:ignore WordPress.DB.SlowDBQuery
			'fields'                 => 'ids',
			'posts_per_page'         => 1,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);
	return (int) $q->found_posts;
}

/* Dashboard menu: a count bubble on "Meeting Updates", like the one on Comments. */
add_action(
	'admin_menu',
	function () {
		global $menu;
		if ( ! current_user_can( 'edit_posts' ) || ! is_array( $menu ) ) {
			return;
		}
		$n = lai_mu_new_count();
		if ( $n < 1 ) {
			return;
		}
		foreach ( $menu as $i => $item ) {
			if ( isset( $item[2] ) && 'edit.php?post_type=' . LAI_MU_CPT === $item[2] ) {
				$menu[ $i ][0] .= sprintf(
					' <span class="awaiting-mod count-%1$d"><span class="pending-count" aria-hidden="true">%2$s</span><span class="screen-reader-text">%3$s</span></span>',
					$n,
					number_format_i18n( $n ),
					esc_html( sprintf( 1 === $n ? '%s new meeting update' : '%s new meeting updates', number_format_i18n( $n ) ) )
				);
				break;
			}
		}
	},
	99
);

/* Settings: where the office notice goes. */
add_action(
	'admin_menu',
	function () {
		add_submenu_page( 'edit.php?post_type=' . LAI_MU_CPT, 'Meeting Update Settings', 'Settings', 'manage_options', 'lai-mu-settings', 'lai_mu_settings_page' );
	}
);
add_action(
	'admin_init',
	function () {
		register_setting(
			'lai_mu',
			'lai_mu_office_email',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_email',
				'default'           => '',
			)
		);
	}
);
function lai_mu_settings_page() {
	echo '<div class="wrap"><h1>Meeting Update Settings</h1><form method="post" action="options.php">';
	settings_fields( 'lai_mu' );
	echo '<table class="form-table"><tr><th scope="row"><label for="lai_mu_office_email">Send notices to</label></th><td>';
	echo '<input type="email" class="regular-text" id="lai_mu_office_email" name="lai_mu_office_email" value="' . esc_attr( get_option( 'lai_mu_office_email', '' ) ) . '" placeholder="' . esc_attr( get_option( 'admin_email' ) ) . '">';
	echo '<p class="description">Each new submission is emailed here. Leave blank to use the site\'s admin email.</p></td></tr></table>';
	submit_button();
	echo '</form></div>';
}

/* ------------------------------------------------------------------
 * Meetings from 12 Step Meeting List (public details only)
 * ------------------------------------------------------------------ */
function lai_mu_day_names() {
	return array( 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' );
}

function lai_mu_time( $t ) {
	if ( ! $t || ! preg_match( '/^(\d{1,2}):(\d{2})/', $t, $m ) ) {
		return '';
	}
	$h  = (int) $m[1];
	$ap = $h >= 12 ? 'pm' : 'am';
	$h  = $h % 12 ? $h % 12 : 12;
	return $h . ':' . $m[2] . ' ' . $ap;
}

function lai_mu_meetings() {
	$cached = get_transient( 'lai_mu_meetings_v2' );
	if ( is_array( $cached ) && $cached ) {
		return $cached;
	}
	$out = array();
	if ( function_exists( 'tsml_get_meetings' ) ) {
		global $tsml_programs, $tsml_program;
		$type_names = ( isset( $tsml_programs[ $tsml_program ]['types'] ) && is_array( $tsml_programs[ $tsml_program ]['types'] ) ) ? $tsml_programs[ $tsml_program ]['types'] : array();
		$days       = lai_mu_day_names();
		foreach ( (array) tsml_get_meetings() as $m ) {
			$m = (array) $m;
			if ( empty( $m['id'] ) || empty( $m['name'] ) ) {
				continue;
			}
			$types = array();
			foreach ( (array) ( isset( $m['types'] ) ? $m['types'] : array() ) as $code ) {
				$types[] = isset( $type_names[ $code ] ) ? $type_names[ $code ] : $code;
			}
			$day   = ( isset( $m['day'] ) && '' !== $m['day'] && isset( $days[ (int) $m['day'] ] ) ) ? $days[ (int) $m['day'] ] : 'By appointment';
			$addr  = isset( $m['formatted_address'] ) ? preg_replace( '/,\s*USA$/', '', $m['formatted_address'] ) : '';
			$parts = array_map( 'trim', explode( ',', $addr ) );
			$out[] = array(
				'id'       => (int) $m['id'],
				'name'     => html_entity_decode( $m['name'], ENT_QUOTES ),
				'day'      => $day,
				'time'     => lai_mu_time( isset( $m['time'] ) ? $m['time'] : '' ),
				'end'      => lai_mu_time( isset( $m['end_time'] ) ? $m['end_time'] : '' ),
				'start24'  => isset( $m['time'] ) ? substr( (string) $m['time'], 0, 5 ) : '',
				'end24'    => isset( $m['end_time'] ) ? substr( (string) $m['end_time'], 0, 5 ) : '',
				'place'    => isset( $m['location'] ) ? html_entity_decode( $m['location'], ENT_QUOTES ) : '',
				'address'  => $addr,
				'town'     => count( $parts ) > 2 ? $parts[ count( $parts ) - 2 ] : ( isset( $m['region'] ) ? (string) $m['region'] : '' ),
				'format'   => implode( ', ', $types ),
				'district' => isset( $m['district'] ) ? (string) $m['district'] : '',
			);
		}
		usort(
			$out,
			function ( $a, $b ) {
				return strcasecmp( $a['name'], $b['name'] );
			}
		);
	}
	if ( $out ) {
		set_transient( 'lai_mu_meetings_v2', $out, HOUR_IN_SECONDS );
	}
	return $out;
}

/* Clear the cached list when a meeting changes. */
add_action(
	'save_post',
	function ( $post_id, $post ) {
		if ( $post && in_array( $post->post_type, array( 'tsml_meeting', 'tsml_location', 'tsml_group' ), true ) ) {
			delete_transient( 'lai_mu_meetings_v2' );
		}
	},
	10,
	2
);

/* ------------------------------------------------------------------
 * The form: [lai_meeting_update]
 * ------------------------------------------------------------------ */
add_shortcode( 'lai_meeting_update', 'lai_mu_shortcode' );
function lai_mu_shortcode() {
	$base = plugin_dir_url( __FILE__ ) . 'assets/';
	wp_enqueue_style( 'lai-mu', $base . 'form.css', array(), LAI_MU_VERSION );
	wp_enqueue_script( 'lai-mu', $base . 'form.js', array(), LAI_MU_VERSION, true );
	$config = array(
		'meetings' => lai_mu_add_roster( lai_mu_meetings() ),
		'rest'     => esc_url_raw( rest_url( 'lai-mu/v1/' ) ),
		'phone'    => '740-653-4869',
	);
	return '<div class="lai-mu" id="lai-mu"><noscript><p>This form needs JavaScript. You can also call the office at 740-653-4869.</p></noscript></div>'
		. '<script type="application/json" id="lai-mu-config">' . wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . '</script>';
}

/* ------------------------------------------------------------------
 * Receiving a submission
 * ------------------------------------------------------------------ */
add_action( 'rest_api_init', 'lai_mu_routes' );
function lai_mu_routes() {
	register_rest_route(
		'lai-mu/v1',
		'/token',
		array(
			'methods'             => 'GET',
			'permission_callback' => '__return_true',
			'callback'            => function () {
				$t = time();
				$r = rest_ensure_response(
					array(
						't' => $t,
						's' => lai_mu_sign( $t ),
					)
				);
				$r->header( 'Cache-Control', 'no-store' );
				return $r;
			},
		)
	);
	register_rest_route(
		'lai-mu/v1',
		'/submit',
		array(
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => 'lai_mu_submit',
		)
	);
}

function lai_mu_sign( $t ) {
	return hash_hmac( 'sha256', 'lai-mu|' . $t, wp_salt( 'nonce' ) );
}

function lai_mu_client_ip() {
	return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
}

/** Keep only expected keys, as plain text. */
function lai_mu_clean( $data, $spec ) {
	$out = array();
	foreach ( $spec as $key => $kind ) {
		$val = isset( $data[ $key ] ) ? $data[ $key ] : null;
		if ( is_array( $kind ) ) {
			$out[ $key ] = lai_mu_clean( is_array( $val ) ? $val : array(), $kind );
		} elseif ( 'bool' === $kind ) {
			$out[ $key ] = ! empty( $val );
		} elseif ( 'int' === $kind ) {
			$out[ $key ] = absint( $val );
		} elseif ( 'list' === $kind ) {
			$out[ $key ] = array_values( array_filter( array_map( 'sanitize_text_field', array_slice( (array) $val, 0, 20 ) ) ) );
		} elseif ( 'email' === $kind ) {
			$out[ $key ] = sanitize_email( (string) $val );
		} elseif ( 'long' === $kind ) {
			$out[ $key ] = mb_substr( sanitize_textarea_field( (string) $val ), 0, 2000 );
		} else {
			$out[ $key ] = mb_substr( sanitize_text_field( (string) $val ), 0, 200 );
		}
	}
	return $out;
}

function lai_mu_submit( WP_REST_Request $req ) {
	$in   = (array) $req->get_json_params();
	$fail = function ( $msg, $code = 400 ) {
		return new WP_Error( 'lai_mu', $msg, array( 'status' => $code ) );
	};

	// Spam trap: a hidden box people never see or fill.
	if ( ! empty( $in['website'] ) ) {
		return rest_ensure_response( array( 'ok' => true ) );
	}
	// The form must have been open for a few seconds, and not for days.
	$t = isset( $in['t'] ) ? (int) $in['t'] : 0;
	$s = isset( $in['s'] ) ? (string) $in['s'] : '';
	if ( ! $t || ! hash_equals( lai_mu_sign( $t ), $s ) || time() - $t < 4 || time() - $t > 2 * DAY_IN_SECONDS ) {
		return $fail( 'Please reload the page and try again.' );
	}
	// No more than 6 sends an hour from one connection.
	$key   = 'lai_mu_rate_' . md5( lai_mu_client_ip() );
	$count = (int) get_transient( $key );
	if ( $count >= 6 ) {
		return $fail( 'Too many updates sent from here in the last hour. Please call the office at 740-653-4869.', 429 );
	}
	set_transient( $key, $count + 1, HOUR_IN_SECONDS );

	$person = array(
		'change' => 'bool',
		'name'   => 'text',
		'phone'  => 'text',
		'email'  => 'email',
		'street' => 'text',
		'city'   => 'text',
		'state'  => 'text',
		'zip'    => 'text',
	);
	$d      = lai_mu_clean(
		$in,
		array(
			'mode'        => 'text',
			'meeting_id'  => 'int',
			'changes'     => array( 'day' => 'text', 'start' => 'text', 'end' => 'text', 'place' => 'text', 'street' => 'text', 'city' => 'text', 'zip' => 'text', 'format' => 'text', 'district' => 'text' ),
			'group'       => array( 'group_id' => 'text', 'phone' => 'text', 'members' => 'text', 'anniversary' => 'text' ),
			'new_meeting' => array( 'name' => 'text', 'day' => 'text', 'start' => 'text', 'end' => 'text', 'place' => 'text', 'street' => 'text', 'city' => 'text', 'state' => 'text', 'zip' => 'text', 'formats' => 'list', 'group_id' => 'text', 'district' => 'text', 'phone' => 'text', 'members' => 'text', 'anniversary' => 'text' ),
			'officers'    => array( 'sec' => $person, 'tre' => $person, 'igr' => $person, 'gsr' => $person ),
			'notes'       => 'long',
			'sender'      => array( 'name' => 'text', 'role' => 'text', 'contact' => 'text' ),
		)
	);

	if ( ! in_array( $d['mode'], array( 'update', 'new' ), true ) ) {
		return $fail( 'Please start again from the first step.' );
	}
	if ( '' === $d['sender']['name'] || '' === $d['sender']['contact'] ) {
		return $fail( 'Please add your name and a phone number or email, so the office can reach you.' );
	}

	// The meeting as it is listed now (public details), kept with the submission.
	$listed = null;
	if ( 'update' === $d['mode'] ) {
		foreach ( lai_mu_meetings() as $m ) {
			if ( $m['id'] === $d['meeting_id'] ) {
				$listed = $m;
				break;
			}
		}
		if ( ! $listed ) {
			return $fail( 'We couldn\'t find that meeting. Please pick it again from the list.' );
		}
		$label = $listed['name'] . ' (' . $listed['day'] . ( $listed['time'] ? ' ' . $listed['time'] : '' ) . ')';
	} else {
		if ( '' === $d['new_meeting']['name'] || '' === $d['new_meeting']['day'] ) {
			return $fail( 'Please give the new meeting\'s name and day.' );
		}
		$label = $d['new_meeting']['name'] . ' (' . trim( $d['new_meeting']['day'] . ' ' . lai_mu_time( $d['new_meeting']['start'] ) ) . ')';
	}
	$d['listed']    = $listed;
	$d['submitted'] = current_time( 'mysql' );

	$spam = lai_mu_akismet_spam( $d );

	$post_id = wp_insert_post(
		array(
			'post_type'   => LAI_MU_CPT,
			'post_status' => 'private',
			'post_title'  => ( 'new' === $d['mode'] ? 'New meeting: ' : 'Update: ' ) . $label,
		),
		true
	);
	if ( is_wp_error( $post_id ) ) {
		return $fail( 'Something went wrong saving your update. Please call the office at 740-653-4869.', 500 );
	}
	update_post_meta( $post_id, 'lai_mu_data', wp_slash( wp_json_encode( $d ) ) );
	update_post_meta( $post_id, 'lai_mu_status', $spam ? 'spam' : 'new' );

	if ( ! $spam ) {
		lai_mu_email_office( $post_id, $d, $label );
	}
	return rest_ensure_response( array( 'ok' => true ) );
}

function lai_mu_akismet_spam( $d ) {
	if ( ! class_exists( 'Akismet' ) || ! method_exists( 'Akismet', 'http_post' ) || ! method_exists( 'Akismet', 'get_api_key' ) || ! Akismet::get_api_key() ) {
		return false;
	}
	$query = array(
		'blog'                 => home_url(),
		'user_ip'              => lai_mu_client_ip(),
		'user_agent'           => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '',
		'referrer'             => isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '',
		'comment_type'         => 'contact-form',
		'comment_author'       => $d['sender']['name'],
		'comment_author_email' => is_email( $d['sender']['contact'] ) ? $d['sender']['contact'] : '',
		'comment_content'      => $d['notes'],
	);
	$resp  = Akismet::http_post( Akismet::build_query( $query ), 'comment-check' );
	return isset( $resp[1] ) && 'true' === trim( $resp[1] );
}

/** "Patricia Smith" -> "Patricia S." for emails. */
function lai_mu_short_name( $name ) {
	$parts = array_values( array_filter( preg_split( '/\s+/', trim( $name ) ) ) );
	if ( ! $parts ) {
		return '';
	}
	$parts = array_map(
		function ( $p ) {
			return mb_strtoupper( mb_substr( $p, 0, 1 ) ) . mb_substr( $p, 1 );
		},
		$parts
	);
	if ( count( $parts ) < 2 ) {
		return $parts[0];
	}
	$last = array_pop( $parts );
	return implode( ' ', $parts ) . ' ' . mb_strtoupper( mb_substr( rtrim( $last, '.' ), 0, 1 ) ) . '.';
}

function lai_mu_roles() {
	return array(
		'sec' => 'Secretary',
		'tre' => 'Treasurer',
		'igr' => 'Intergroup Rep (IGR)',
		'gsr' => 'General Service Rep (GSR)',
	);
}

function lai_mu_email_office( $post_id, $d, $label ) {
	$lines   = array();
	$lines[] = ( 'new' === $d['mode'] ? 'A NEW MEETING was submitted on the website:' : 'A meeting update came in from the website:' );
	$lines[] = $label;
	$lines[] = '';
	if ( 'update' === $d['mode'] ) {
		$names   = array( 'day' => 'Day', 'start' => 'Start time', 'end' => 'End time', 'place' => 'Building', 'street' => 'Street address', 'city' => 'City', 'zip' => 'ZIP', 'format' => 'Type/format', 'district' => 'District' );
		$changed = array();
		foreach ( $names as $k => $n ) {
			if ( '' !== $d['changes'][ $k ] ) {
				$changed[] = $n;
			}
		}
		$lines[] = 'Meeting details changing: ' . ( $changed ? implode( ', ', $changed ) : 'none' );
	}
	$anniv = 'new' === $d['mode'] ? $d['new_meeting']['anniversary'] : $d['group']['anniversary'];
	if ( '' !== $anniv ) {
		$lines[] = 'Group anniversary: ' . $anniv;
	}
	$off = array();
	foreach ( lai_mu_roles() as $k => $n ) {
		$o = $d['officers'][ $k ];
		if ( ( 'new' === $d['mode'] || $o['change'] ) && '' !== $o['name'] ) {
			$off[] = $n . ': ' . lai_mu_short_name( $o['name'] );
		}
	}
	$lines[] = 'Officers: ' . ( $off ? implode( '; ', $off ) : 'no changes' );
	if ( '' !== $d['notes'] ) {
		$lines[] = '';
		$lines[] = 'Notes: ' . $d['notes'];
	}
	$lines[] = '';
	$lines[] = 'Sent by: ' . lai_mu_short_name( $d['sender']['name'] ) . ( $d['sender']['role'] ? ' (' . $d['sender']['role'] . ')' : '' );
	$lines[] = '';
	$lines[] = 'Full details (phone numbers, emails, addresses) are in the dashboard under Meeting Updates:';
	$lines[] = admin_url( 'post.php?post=' . $post_id . '&action=edit' );
	wp_mail(
		lai_mu_office_email(),
		( 'new' === $d['mode'] ? '[LAI website] New meeting: ' : '[LAI website] Meeting update: ' ) . $label,
		implode( "\n", $lines )
	);
}

/* ------------------------------------------------------------------
 * Dashboard: list columns and a readable view of each submission
 * ------------------------------------------------------------------ */
add_filter(
	'manage_' . LAI_MU_CPT . '_posts_columns',
	function () {
		return array(
			'cb'           => '<input type="checkbox" />',
			'title'        => 'Meeting',
			'lai_mu_from'  => 'Sent by',
			'lai_mu_state' => 'Status',
			'date'         => 'Received',
		);
	}
);
add_action(
	'manage_' . LAI_MU_CPT . '_posts_custom_column',
	function ( $col, $post_id ) {
		$d = json_decode( (string) get_post_meta( $post_id, 'lai_mu_data', true ), true );
		if ( 'lai_mu_from' === $col && is_array( $d ) ) {
			echo esc_html( $d['sender']['name'] . ( $d['sender']['role'] ? ' – ' . $d['sender']['role'] : '' ) );
		}
		if ( 'lai_mu_state' === $col ) {
			$s = get_post_meta( $post_id, 'lai_mu_status', true );
			echo esc_html( 'done' === $s ? 'Done' : ( 'spam' === $s ? 'Spam' : 'New' ) );
		}
	},
	10,
	2
);

add_action(
	'add_meta_boxes_' . LAI_MU_CPT,
	function () {
		add_meta_box( 'lai_mu_view', 'What was sent', 'lai_mu_render_box', LAI_MU_CPT, 'normal', 'high' );
		add_meta_box( 'lai_mu_state', 'Status', 'lai_mu_status_box', LAI_MU_CPT, 'side', 'high' );
		remove_meta_box( 'postcustom', LAI_MU_CPT, 'normal' );
	}
);

function lai_mu_row( $label, $value ) {
	if ( '' === (string) $value ) {
		return '';
	}
	return '<tr><th style="text-align:left;width:220px;vertical-align:top;padding:4px 10px 4px 0">' . esc_html( $label ) . '</th><td style="padding:4px 0">' . nl2br( esc_html( $value ) ) . '</td></tr>';
}

function lai_mu_render_box( $post ) {
	$d = json_decode( (string) get_post_meta( $post->ID, 'lai_mu_data', true ), true );
	if ( ! is_array( $d ) ) {
		echo '<p>No details saved.</p>';
		return;
	}
	$h = '<table class="widefat striped" style="border:0">';
	if ( 'update' === $d['mode'] && is_array( $d['listed'] ) ) {
		$l  = $d['listed'];
		$h .= '<tr><td colspan="2"><strong>Listed now</strong></td></tr>';
		$h .= lai_mu_row( 'Meeting', $l['name'] );
		$h .= lai_mu_row( 'Day and time', trim( $l['day'] . ' ' . $l['time'] . ( $l['end'] ? ' – ' . $l['end'] : '' ) ) );
		$h .= lai_mu_row( 'Building', $l['place'] );
		$h .= lai_mu_row( 'Address', $l['address'] );
		$h .= lai_mu_row( 'Type/format', $l['format'] );
		$h .= lai_mu_row( 'District', $l['district'] );
		$h .= '<tr><td colspan="2"><strong>Changes asked for</strong></td></tr>';
		$c  = $d['changes'];
		$h .= lai_mu_row( 'New day', $c['day'] ) . lai_mu_row( 'New start time', lai_mu_time( $c['start'] ) ) . lai_mu_row( 'New end time', lai_mu_time( $c['end'] ) );
		$h .= lai_mu_row( 'New building', $c['place'] ) . lai_mu_row( 'New street address', $c['street'] ) . lai_mu_row( 'New city', $c['city'] ) . lai_mu_row( 'New ZIP', $c['zip'] );
		$h .= lai_mu_row( 'New type/format', $c['format'] ) . lai_mu_row( 'Correct district', $c['district'] );
		$g  = $d['group'];
		$h .= lai_mu_row( 'Group anniversary', isset( $g['anniversary'] ) ? $g['anniversary'] : '' ) . lai_mu_row( 'Group ID #', $g['group_id'] ) . lai_mu_row( 'Group phone', $g['phone'] ) . lai_mu_row( 'Number of members', $g['members'] );
	} elseif ( 'new' === $d['mode'] ) {
		$n  = $d['new_meeting'];
		$h .= '<tr><td colspan="2"><strong>New meeting</strong></td></tr>';
		$h .= lai_mu_row( 'Group name', $n['name'] ) . lai_mu_row( 'Day', $n['day'] ) . lai_mu_row( 'Start', lai_mu_time( $n['start'] ) ) . lai_mu_row( 'End', lai_mu_time( $n['end'] ) );
		$h .= lai_mu_row( 'Building', $n['place'] ) . lai_mu_row( 'Street address', $n['street'] ) . lai_mu_row( 'City', $n['city'] ) . lai_mu_row( 'State', $n['state'] ) . lai_mu_row( 'ZIP', $n['zip'] );
		$h .= lai_mu_row( 'Type/format', implode( ', ', (array) $n['formats'] ) ) . lai_mu_row( 'Group ID #', $n['group_id'] ) . lai_mu_row( 'District', $n['district'] );
		$h .= lai_mu_row( 'Group anniversary', isset( $n['anniversary'] ) ? $n['anniversary'] : '' ) . lai_mu_row( 'Group phone', $n['phone'] ) . lai_mu_row( 'Number of members', $n['members'] );
	}
	$h  .= '<tr><td colspan="2"><strong>Officers</strong></td></tr>';
	$any = false;
	foreach ( lai_mu_roles() as $k => $n ) {
		$o = $d['officers'][ $k ];
		if ( 'new' !== $d['mode'] && ! $o['change'] ) {
			continue;
		}
		$addr = trim( implode( ', ', array_filter( array( $o['street'], $o['city'], trim( $o['state'] . ' ' . $o['zip'] ) ) ) ) );
		$val  = trim( implode( "\n", array_filter( array( $o['name'], $o['phone'], $o['email'], $addr ) ) ) );
		if ( '' !== $val ) {
			$h  .= lai_mu_row( $n, $val );
			$any = true;
		}
	}
	if ( ! $any ) {
		$h .= lai_mu_row( 'Officers', 'No changes' );
	}
	$h .= '<tr><td colspan="2"><strong>Notes and sender</strong></td></tr>';
	$h .= lai_mu_row( 'Notes', $d['notes'] );
	$h .= lai_mu_row( 'Sent by', trim( $d['sender']['name'] . ( $d['sender']['role'] ? ' – ' . $d['sender']['role'] : '' ) ) );
	$h .= lai_mu_row( 'Their phone or email', $d['sender']['contact'] );
	$h .= lai_mu_row( 'Received', $d['submitted'] );
	$h .= '</table>';
	echo $h; // phpcs:ignore WordPress.Security.EscapeOutput -- every value is escaped in lai_mu_row().
}

function lai_mu_status_box( $post ) {
	$s = get_post_meta( $post->ID, 'lai_mu_status', true );
	wp_nonce_field( 'lai_mu_status', 'lai_mu_status_nonce' );
	echo '<select name="lai_mu_status" style="width:100%">';
	foreach ( array( 'new' => 'New', 'done' => 'Done', 'spam' => 'Spam' ) as $k => $n ) {
		echo '<option value="' . esc_attr( $k ) . '"' . selected( $s, $k, false ) . '>' . esc_html( $n ) . '</option>';
	}
	echo '</select><p class="description">Mark Done once the change is entered.</p>';
}

add_action(
	'save_post_' . LAI_MU_CPT,
	function ( $post_id ) {
		if ( ! isset( $_POST['lai_mu_status_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['lai_mu_status_nonce'] ) ), 'lai_mu_status' ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) || ! isset( $_POST['lai_mu_status'] ) ) {
			return;
		}
		$s = sanitize_key( wp_unslash( $_POST['lai_mu_status'] ) );
		if ( in_array( $s, array( 'new', 'done', 'spam' ), true ) ) {
			update_post_meta( $post_id, 'lai_mu_status', $s );
		}
	}
);

/* ==================================================================
 * Group Information Change Form (office use) – [lai_group_change_form]
 * Shows the paper form filled in for one meeting, ready to print.
 * Only works on a PASSWORD-PROTECTED page (after the password is entered)
 * or for signed-in editors. Officer details come from a private item
 * ("lai_mu_officers"), refreshed hourly from the office's U/D groups sheet.
 * ================================================================== */
add_action(
	'init',
	function () {
		register_post_type(
			'lai_mu_officers',
			array(
				'label'               => 'Officer details (office use)',
				'public'              => false,
				'publicly_queryable'  => false,
				'exclude_from_search' => true,
				'show_ui'             => false,
				'show_in_rest'        => true,
				'rest_base'           => 'lai-mu-officers',
				'rewrite'             => false,
				'query_var'           => false,
				'supports'            => array( 'title', 'custom-fields' ),
				'capability_type'     => 'post',
				'map_meta_cap'        => true,
			)
		);
		register_post_meta(
			'lai_mu_officers',
			'lai_mu_officers',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
				'description'   => 'JSON list of U/D groups rows: row, grp_id, day_time, name, city, igr, gsr, anniv, sec, sec_phone, sec_email, tre, tre_phone, tre_email, district, grp_phone, members, sec_addr, tre_addr.',
			)
		);
	},
	11
);

function lai_mu_gcf_allowed() {
	$post = get_post();
	if ( current_user_can( 'edit_posts' ) ) {
		return true;
	}
	return $post && '' !== $post->post_password && ! post_password_required( $post );
}

function lai_mu_officer_rows() {
	$items = get_posts(
		array(
			'post_type'        => 'lai_mu_officers',
			'post_status'      => array( 'private', 'draft', 'publish' ),
			'numberposts'      => 1,
			'orderby'          => 'modified',
			'order'            => 'DESC',
			'suppress_filters' => true,
		)
	);
	if ( ! $items ) {
		return array();
	}
	$rows = json_decode( (string) get_post_meta( $items[0]->ID, 'lai_mu_officers', true ), true );
	if ( ! is_array( $rows ) ) {
		return array();
	}
	$out  = array();
	$keys = array( 'grp_id', 'day_time', 'name', 'city', 'igr', 'gsr', 'anniv', 'sec', 'sec_phone', 'sec_email', 'tre', 'tre_phone', 'tre_email', 'district', 'grp_phone', 'members', 'sec_addr', 'tre_addr' );
	foreach ( $rows as $r ) {
		if ( ! is_array( $r ) || empty( $r['name'] ) ) {
			continue;
		}
		$c = array( 'row' => isset( $r['row'] ) ? absint( $r['row'] ) : 0 );
		foreach ( $keys as $k ) {
			$c[ $k ] = isset( $r[ $k ] ) ? sanitize_text_field( (string) $r[ $k ] ) : '';
		}
		$out[] = $c;
	}
	return $out;
}

/** True on a page that uses the Group Change Form shortcode. */
function lai_mu_is_gcf_page() {
	$post = get_post();
	return is_singular() && $post && has_shortcode( $post->post_content, 'lai_group_change_form' );
}

/* Keep this page out of search engines and caches. */
add_filter(
	'wp_robots',
	function ( $robots ) {
		if ( lai_mu_is_gcf_page() ) {
			$robots['noindex']  = true;
			$robots['nofollow'] = true;
		}
		return $robots;
	}
);
/* Rank Math prints its own robots tag instead of WordPress's, so tell it too. */
add_filter(
	'rank_math/frontend/robots',
	function ( $robots ) {
		if ( lai_mu_is_gcf_page() ) {
			$robots['index']  = 'noindex';
			$robots['follow'] = 'nofollow';
		}
		return $robots;
	}
);
add_action(
	'template_redirect',
	function () {
		$post = get_post();
		if ( is_singular() && $post && has_shortcode( $post->post_content, 'lai_group_change_form' ) ) {
			nocache_headers();
		}
	}
);

add_shortcode( 'lai_group_change_form', 'lai_mu_gcf_shortcode' );
function lai_mu_gcf_shortcode() {
	if ( ! lai_mu_gcf_allowed() ) {
		return '<p>This page is for office use. Please set a password on it (Page settings › Visibility › Password protected).</p>';
	}
	$base = plugin_dir_url( __FILE__ ) . 'assets/';
	wp_enqueue_style( 'lai-gcf', $base . 'gcf.css', array(), LAI_MU_VERSION );
	wp_enqueue_script( 'lai-gcf', $base . 'gcf.js', array(), LAI_MU_VERSION, true );
	$config = array(
		'meetings' => lai_mu_meetings(),
		'officers' => lai_mu_officer_rows(),
	);
	ob_start();
	?>
<div class="lai-gcf" id="lai-gcf">
	<div class="lai-gcf-bar">
		<div class="lai-gcf-find">
			<label for="lai-gcf-q">Find a meeting</label>
			<input id="lai-gcf-q" type="search" autocomplete="off" placeholder="Start typing a meeting name…" role="combobox" aria-expanded="false" aria-controls="lai-gcf-list">
			<ul id="lai-gcf-list" role="listbox" hidden></ul>
		</div>
		<button type="button" id="lai-gcf-print" disabled>Print / Save as PDF</button>
	</div>
	<div class="lai-gcf-opts">
		<label><input type="checkbox" id="lai-gcf-reps" checked> Fill IGR and GSR with what's on file</label>
		<label><input type="checkbox" id="lai-gcf-new"> Copy current officer phone, email and mailing address to the "new" side, for the group to check</label>
	</div>
	<p id="lai-gcf-status" class="lai-gcf-status" role="status"></p>
	<form class="lai-gcf-paper" id="lai-gcf-paper" hidden autocomplete="off" onsubmit="return false">
		<h2>Group Information Change Form</h2>
		<div class="lai-gcf-rule"></div>
		<div class="lai-gcf-two">
			<div class="lai-gcf-f"><b>GROUP ID #:</b><input id="g-grpId"></div>
			<div class="lai-gcf-f"><b>DATE:</b><input id="g-date"></div>
			<div class="lai-gcf-f"><b>AREA #:</b><input id="g-area"></div>
			<div class="lai-gcf-f"><b>DISTRICT #:</b><input id="g-district"></div>
		</div>
		<div class="lai-gcf-cols">
			<div>
				<span class="lai-gcf-tag">OLD INFORMATION</span>
				<div class="lai-gcf-f"><b>GROUP NAME:</b><input id="g-name"></div>
				<div class="lai-gcf-f"><b>TYPE/FORMAT:</b><input id="g-format"></div>
				<div class="lai-gcf-f"><b>GROUP MEETING LOCATION:</b><input id="g-location"></div>
				<div class="lai-gcf-f"><b>ADDRESS:</b><input id="g-address"></div>
				<div class="lai-gcf-f"><b>CITY/TOWN:</b><input id="g-city"></div>
				<div class="lai-gcf-two lai-gcf-tight"><div class="lai-gcf-f"><b>STATE/PROVINCE:</b><input id="g-state"></div><div class="lai-gcf-f"><b>POSTAL CODE:</b><input id="g-zip"></div></div>
				<div class="lai-gcf-f"><b>PHONE:</b><input id="g-phone"></div>
				<div class="lai-gcf-f"><b>NUMBER OF MEMBERS:</b><input id="g-members"></div>
				<div class="lai-gcf-sub">SECRETARY</div>
				<div class="lai-gcf-f"><b>NAME:</b><input id="g-oldSec"></div>
				<div class="lai-gcf-sub">TREASURER</div>
				<div class="lai-gcf-f"><b>NAME:</b><input id="g-oldTre"></div>
			</div>
			<div>
				<span class="lai-gcf-tag">NEW INFORMATION</span>
				<div class="lai-gcf-sub lai-gcf-first">SECRETARY</div>
				<div class="lai-gcf-f"><b>NAME:</b><input id="g-sName"></div>
				<div class="lai-gcf-f"><b>ADDRESS:</b><input id="g-sAddr"></div>
				<div class="lai-gcf-f"><b>CITY/TOWN:</b><input id="g-sCity"></div>
				<div class="lai-gcf-two lai-gcf-tight"><div class="lai-gcf-f"><b>STATE/PROVINCE:</b><input id="g-sState"></div><div class="lai-gcf-f"><b>ZIPCODE:</b><input id="g-sZip"></div></div>
				<div class="lai-gcf-f"><b>PHONE:</b><input id="g-sPhone"></div>
				<div class="lai-gcf-f"><b>EMAIL:</b><input id="g-sEmail"></div>
				<div class="lai-gcf-sub">TREASURER</div>
				<div class="lai-gcf-f"><b>NAME:</b><input id="g-tName"></div>
				<div class="lai-gcf-f"><b>ADDRESS:</b><input id="g-tAddr"></div>
				<div class="lai-gcf-f"><b>CITY/TOWN:</b><input id="g-tCity"></div>
				<div class="lai-gcf-two lai-gcf-tight"><div class="lai-gcf-f"><b>STATE/PROVINCE:</b><input id="g-tState"></div><div class="lai-gcf-f"><b>POSTAL CODE:</b><input id="g-tZip"></div></div>
				<div class="lai-gcf-f"><b>PHONE:</b><input id="g-tPhone"></div>
				<div class="lai-gcf-f"><b>EMAIL:</b><input id="g-tEmail"></div>
			</div>
		</div>
		<div class="lai-gcf-sub lai-gcf-plain">INTERGROUP REP (IGR)</div>
		<div class="lai-gcf-three"><div class="lai-gcf-f"><b>NAME:</b><input id="g-igrName"></div><div class="lai-gcf-f"><b>PHONE:</b><input id="g-igrPhone"></div><div class="lai-gcf-f"><b>EMAIL:</b><input id="g-igrEmail"></div></div>
		<div class="lai-gcf-sub lai-gcf-plain">GENERAL SERVICE REP (GSR)</div>
		<div class="lai-gcf-three"><div class="lai-gcf-f"><b>NAME:</b><input id="g-gsrName"></div><div class="lai-gcf-f"><b>PHONE:</b><input id="g-gsrPhone"></div><div class="lai-gcf-f"><b>EMAIL:</b><input id="g-gsrEmail"></div></div>
		<p class="lai-gcf-fine">A group listing does not constitute or imply an approval or endorsement of any group’s practice of the A.A. program. Tradition Four says, “Each group should be autonomous except in matters affecting other groups or A.A. as a whole.” Hopefully every A.A. Group adheres closely to the guiding principles of the Steps, Traditions, and Concepts.</p>
		<p class="lai-gcf-fine"><i>A.A.’s Traditions suggest that a group not be named after a facility or person (living or deceased), and that the name of a group not imply affiliation with any sect, religion, organization or institution.</i></p>
		<div class="lai-gcf-ret">
			<div class="lai-gcf-ret-hd">RETURN FORM TO</div>
			<div class="lai-gcf-ret-l">LANCASTER AREA INTERGROUP<br>723 SLOCUM AVE<br>LANCASTER OHIO 43130</div>
			<div><b>Email</b><br>lancaster.area.intergroup.aa@gmail.com<br><b>Or Complete Online</b><br>lancasterareaintergroup.org/info-for-meetings</div>
		</div>
		<div class="lai-gcf-rev">Rev. 11/26</div>
	</form>
</div>
<script type="application/json" id="lai-gcf-config"><?php echo wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ); ?></script>
	<?php
	return ob_get_clean();
}
