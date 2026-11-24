<?php
/**
 * Plugin Name: LAI FAQ Schema
 * Description: Adds FAQ structured data (FAQPage JSON-LD) to the "FAQs about LAI and AA" page, built automatically from its question headings (H3) and the answers under them. Edit the page as usual; the data updates itself. Changes nothing on screen.
 * Version: 1.0.0
 * Author: Lancaster Area Intergroup
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LAI_FAQ_PAGE_SLUG', 'faqs-about-lai-and-aa' );

function lai_faq_text( $node ) {
	$text = trim( preg_replace( '/\s+/u', ' ', $node->textContent ) );
	return $text;
}

function lai_faq_build( $post ) {
	$html = do_blocks( $post->post_content );
	$html = do_shortcode( $html );
	if ( '' === trim( $html ) || ! class_exists( 'DOMDocument' ) ) {
		return array();
	}

	$doc = new DOMDocument();
	libxml_use_internal_errors( true );
	$doc->loadHTML( '<?xml encoding="utf-8"?><div id="lai-faq-root">' . $html . '</div>' );
	libxml_clear_errors();

	$xpath = new DOMXPath( $doc );
	$root  = $xpath->query( '//*[@id="lai-faq-root"]' )->item( 0 );
	if ( ! $root ) {
		return array();
	}

	$items    = array();
	$question = null;
	$answer   = array();

	$flush = function () use ( &$items, &$question, &$answer ) {
		if ( $question && $answer ) {
			$items[] = array(
				'@type'          => 'Question',
				'name'           => $question,
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => implode( ' ', $answer ),
				),
			);
		}
		$question = null;
		$answer   = array();
	};

	foreach ( $root->childNodes as $node ) {
		if ( XML_ELEMENT_NODE !== $node->nodeType ) {
			continue;
		}
		$tag = strtolower( $node->nodeName );
		if ( 'h3' === $tag ) {
			$flush();
			$question = lai_faq_text( $node );
		} elseif ( in_array( $tag, array( 'h1', 'h2' ), true ) ) {
			$flush();
		} elseif ( $question ) {
			if ( 'ul' === $tag || 'ol' === $tag ) {
				$parts = array();
				foreach ( $node->getElementsByTagName( 'li' ) as $li ) {
					$parts[] = lai_faq_text( $li );
				}
				if ( $parts ) {
					$answer[] = implode( '; ', $parts ) . '.';
				}
			} else {
				$t = lai_faq_text( $node );
				if ( '' !== $t ) {
					$answer[] = $t;
				}
			}
		}
	}
	$flush();

	return $items;
}

function lai_faq_output() {
	if ( ! is_page( LAI_FAQ_PAGE_SLUG ) ) {
		return;
	}
	$post = get_queried_object();
	if ( ! $post instanceof WP_Post ) {
		return;
	}

	$key   = 'lai_faq_schema_' . $post->ID . '_' . md5( $post->post_modified_gmt );
	$items = get_transient( $key );
	if ( false === $items ) {
		$items = lai_faq_build( $post );
		set_transient( $key, $items, DAY_IN_SECONDS );
	}
	if ( empty( $items ) ) {
		return;
	}

	$data = array(
		'@context'   => 'https://schema.org',
		'@type'      => 'FAQPage',
		'url'        => get_permalink( $post ),
		'mainEntity' => $items,
	);

	echo "\n<script type=\"application/ld+json\" class=\"lai-faq-schema\">" . wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "</script>\n";
}
add_action( 'wp_head', 'lai_faq_output', 30 );
