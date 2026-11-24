<?php
/**
 * Plugin Name: LAI Meeting List (Text Version)
 * Description: Adds the [lai_meetings_list] shortcode, which prints the full weekly meeting schedule from 12 Step Meeting List as plain HTML so search engines and screen readers can read it. Read-only: it never changes meetings.
 * Version: 1.0.1
 * Author: Lancaster Area Intergroup
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LAI_MLH_CACHE_KEY', 'lai_mlh_html_v2' );

/**
 * Human-readable names for meeting type codes, from 12 Step Meeting List when available.
 */
function lai_mlh_type_names() {
	global $tsml_programs, $tsml_program;
	if ( is_array( $tsml_programs ) && ! empty( $tsml_program ) && ! empty( $tsml_programs[ $tsml_program ]['types'] ) ) {
		return $tsml_programs[ $tsml_program ]['types'];
	}
	return array( 'O' => 'Open', 'C' => 'Closed' );
}

/**
 * Town from an address such as "123 Main St, Lancaster, OH 43130, USA".
 */
function lai_mlh_town( $address ) {
	$parts = array_map( 'trim', explode( ',', (string) $address ) );
	$count = count( $parts );
	if ( $count >= 3 ) {
		return $parts[ $count - 3 ];
	}
	return '';
}

function lai_mlh_render() {
	if ( ! function_exists( 'tsml_get_meetings' ) ) {
		return '';
	}

	$cached = get_transient( LAI_MLH_CACHE_KEY );
	if ( false !== $cached ) {
		return $cached;
	}

	$meetings = tsml_get_meetings();
	if ( empty( $meetings ) || ! is_array( $meetings ) ) {
		return '';
	}

	$days       = array( 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' );
	$type_names = lai_mlh_type_names();
	$by_day     = array();

	foreach ( $meetings as $m ) {
		if ( ! isset( $m['day'] ) || '' === $m['day'] || ! isset( $days[ (int) $m['day'] ] ) ) {
			continue;
		}
		$by_day[ (int) $m['day'] ][] = $m;
	}
	ksort( $by_day );

	$total = 0;
	ob_start();
	echo '<section class="lai-meetings-list">';
	echo '<h2>Weekly meeting schedule</h2><details><summary>Show every meeting as a list, by day</summary>';
	foreach ( $by_day as $day => $list ) {
		usort(
			$list,
			function ( $a, $b ) {
				return strcmp( isset( $a['time'] ) ? $a['time'] : '', isset( $b['time'] ) ? $b['time'] : '' );
			}
		);
		echo '<h3>' . esc_html( $days[ $day ] ) . '</h3><ul>';
		foreach ( $list as $m ) {
			$total++;
			$time     = ! empty( $m['time_formatted'] ) ? $m['time_formatted'] : ( isset( $m['time'] ) ? $m['time'] : '' );
			$name     = isset( $m['name'] ) ? $m['name'] : '';
			$url      = isset( $m['url'] ) ? $m['url'] : '';
			$location = isset( $m['location'] ) ? trim( $m['location'], " .\t" ) : '';
			$town     = lai_mlh_town( isset( $m['formatted_address'] ) ? $m['formatted_address'] : '' );

			$labels = array();
			if ( ! empty( $m['types'] ) && is_array( $m['types'] ) ) {
				foreach ( $m['types'] as $code ) {
					if ( in_array( $code, array( 'O', 'C' ), true ) && isset( $type_names[ $code ] ) ) {
						$labels[] = $type_names[ $code ];
					}
				}
			}
			if ( ! empty( $m['attendance_option'] ) && 'online' === $m['attendance_option'] ) {
				$labels[] = 'Online';
			}

			$where = trim( $location . ( $town ? ', ' . $town : '' ), ', ' );

			echo '<li><strong>' . esc_html( $time ) . '</strong> &ndash; ';
			echo $url ? '<a href="' . esc_url( $url ) . '">' . esc_html( $name ) . '</a>' : esc_html( $name );
			if ( $where ) {
				echo ', ' . esc_html( $where );
			}
			if ( $labels ) {
				echo ' (' . esc_html( implode( ', ', $labels ) ) . ')';
			}
			echo '</li>';
		}
		echo '</ul>';
	}
	echo '</details></section>';
	$html = ob_get_clean();

	if ( 0 === $total ) {
		return '';
	}

	set_transient( LAI_MLH_CACHE_KEY, $html, 6 * HOUR_IN_SECONDS );
	return $html;
}

add_shortcode( 'lai_meetings_list', 'lai_mlh_render' );

/**
 * Rebuild the list whenever a meeting, location or group changes.
 */
function lai_mlh_flush( $post_id ) {
	$type = get_post_type( $post_id );
	if ( $type && 0 === strpos( $type, 'tsml_' ) ) {
		delete_transient( LAI_MLH_CACHE_KEY );
	}
}
add_action( 'save_post', 'lai_mlh_flush' );
add_action( 'deleted_post', 'lai_mlh_flush' );
add_action( 'trashed_post', 'lai_mlh_flush' );
