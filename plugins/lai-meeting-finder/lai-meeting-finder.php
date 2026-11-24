<?php
/**
 * Plugin Name: LAI Meeting Finder
 * Description: A friendly meeting finder for Lancaster Area Intergroup, with a free OpenFreeMap map and "Next meeting near me". Reads its meetings from 12 Step Meeting List (never changes them). Use the [lai_meetings] shortcode, or show it at /meetings from Settings > LAI Meeting Finder.
 * Version: 1.0.0
 * Requires Plugins: 12-step-meeting-list
 * Author: Lancaster Area Intergroup (adapted from Area 53 Meeting Finder 0.5.1)
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('LAIM_VERSION', '1.0.0');
define('LAIM_URL', plugin_dir_url(__FILE__));
define('LAIM_CACHE_KEY', 'laim_meetings_v1');

/**
 * A fingerprint of 12 Step Meeting List's own cache file. TSML rewrites that file after
 * every change (editing, importing, deleting, settings), so when it changes we rebuild too.
 */
function laim_tsml_signature()
{
    global $tsml_cache, $tsml_cache_writable;
    if (empty($tsml_cache) || empty($tsml_cache_writable) || !defined('WP_CONTENT_DIR')) {
        return '';
    }
    $file = WP_CONTENT_DIR . $tsml_cache;
    if (!file_exists($file)) {
        return '';
    }
    clearstatcache(true, $file);
    return filemtime($file) . '-' . filesize($file);
}

/**
 * The compact meeting list sent to the page. Contact names, emails and phones are never included.
 */
function laim_get_payload()
{
    if (!function_exists('tsml_get_meetings')) {
        return null;
    }
    $sig = laim_tsml_signature();
    $cached = get_transient(LAIM_CACHE_KEY);
    if (is_array($cached) && isset($cached['sig'], $cached['payload']) && $cached['sig'] === $sig) {
        return $cached['payload'];
    }

    global $tsml_programs, $tsml_program, $tsml_timezone;

    $keep = [
        'id', 'name', 'slug', 'url', 'day', 'time', 'end_time', 'attendance_option', 'types',
        'location', 'formatted_address', 'address', 'city', 'state', 'region', 'sub_region',
        'district', 'group', 'notes', 'location_notes', 'conference_url', 'conference_url_notes',
        'conference_phone', 'conference_phone_notes', 'latitude', 'longitude', 'approximate', 'updated', 'feedback_url',
    ];

    $meetings = [];
    foreach ((array) tsml_get_meetings() as $m) {
        $row = [];
        foreach ($keep as $k) {
            if (isset($m[$k]) && $m[$k] !== '' && $m[$k] !== []) {
                $row[$k] = $m[$k];
            }
        }
        if (!isset($row['day']) || $row['day'] === '' || empty($row['time'])) {
            continue; // appointment-only meetings have no day/time
        }
        $row['day'] = (int) $row['day'];
        // only Online and In person + online meetings keep their online links
        $att = isset($row['attendance_option']) ? $row['attendance_option'] : '';
        if ($att !== 'online' && $att !== 'hybrid') {
            unset($row['conference_url'], $row['conference_url_notes'], $row['conference_phone'], $row['conference_phone_notes']);
        }
        $meetings[] = $row;
    }

    $payload = [
        'meetings' => $meetings,
        'types' => !empty($tsml_programs[$tsml_program]['types']) ? $tsml_programs[$tsml_program]['types'] : [],
        'timezone' => $tsml_timezone ?: wp_timezone_string(),
        'generated' => time(),
    ];

    set_transient(LAIM_CACHE_KEY, ['sig' => $sig, 'payload' => $payload], $sig === '' ? 10 * MINUTE_IN_SECONDS : DAY_IN_SECONDS);
    return $payload;
}

function laim_clear_cache($post_id = 0)
{
    if ($post_id && !in_array(get_post_type($post_id), ['tsml_meeting', 'tsml_location', 'tsml_group'], true)) {
        return;
    }
    delete_transient(LAIM_CACHE_KEY);
}
add_action('save_post', 'laim_clear_cache');
add_action('deleted_post', 'laim_clear_cache');
add_action('edited_term', function () { laim_clear_cache(); });
register_activation_hook(__FILE__, function () { delete_transient(LAIM_CACHE_KEY); });

/**
 * [lai_meetings] shortcode. Optional attributes:
 *   day="today|any|0-6"     day selected when the page opens (default today)
 *   region="Lancaster"      start on one town
 *   view="list|map"         which view opens first (default list)
 *   map="yes|no"            show the Map button (default yes)
 *   map_style="positron|liberty|bright|dark|fiord"  map look (default positron)
 */
function laim_shortcode($atts)
{
    $atts = shortcode_atts([
        'day' => 'today',
        'region' => '',
        'district' => '',
        'filter' => 'region',
        'view' => 'list',
        'map' => 'yes',
        'map_style' => 'positron',
        'map_style_dark' => '',
        'open' => '',
    ], $atts, 'lai_meetings');
    $payload = laim_get_payload();
    if (!$payload) {
        return '<p class="laim-error">The 12 Step Meeting List plugin must be active to show meetings.</p>';
    }

    wp_enqueue_style('laim', LAIM_URL . 'assets/css/lai-meetings.css', [], LAIM_VERSION);
    wp_enqueue_script('laim', LAIM_URL . 'assets/lai-meetings.js', [], LAIM_VERSION, ['in_footer' => true]);

    $id = 'laim-' . wp_unique_id();
    $config = [
        'defaultDay' => sanitize_text_field($atts['day']),
        'defaultRegion' => sanitize_text_field($atts['region']),
        'defaultDistrict' => sanitize_text_field($atts['district']),
        'filter' => in_array($atts['filter'], ['district', 'region', 'both'], true) ? $atts['filter'] : 'region',
        'defaultView' => $atts['view'] === 'map' ? 'map' : 'list',
        'openMeeting' => (int) $atts['open'],
        'center' => [-82.5993, 39.7137], // Lancaster, Ohio
    ];

    // MapLibre GL JS is bundled and only downloaded when someone opens the Map view.
    // Tiles come from OpenFreeMap (https://openfreemap.org): free, no API key, no billing.
    if (strtolower($atts['map']) !== 'no') {
        $styles = ['positron', 'liberty', 'bright', 'dark', 'fiord'];
        $style = in_array($atts['map_style'], $styles, true) ? $atts['map_style'] : 'positron';
        $config['mapStyle'] = apply_filters('laim_map_style_url', 'https://tiles.openfreemap.org/styles/' . $style);
        if (in_array($atts['map_style_dark'], $styles, true)) {
            $config['mapStyleDark'] = 'https://tiles.openfreemap.org/styles/' . $atts['map_style_dark'];
        }
        $config['maplibreJs'] = LAIM_URL . 'assets/vendor/maplibre/maplibre-gl.js?ver=5.24.1';
        $config['maplibreCss'] = LAIM_URL . 'assets/vendor/maplibre/maplibre-gl.css?ver=5.24.1';
    }

    $json = wp_json_encode(['data' => $payload, 'config' => $config], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

    return '<div class="laim" id="' . esc_attr($id) . '" data-laim>'
        . '<noscript>Please enable JavaScript to use the meeting finder.</noscript>'
        . '<script type="application/json" class="laim-data">' . $json . '</script>'
        . '</div>';
}
add_shortcode('lai_meetings', 'laim_shortcode');

/* -------------------------------------------------------------------------------------------
 * Optional: use this finder for the /meetings page that 12 Step Meeting List serves.
 * Switched on under Settings > LAI Meeting Finder. Turning it off (or deactivating this
 * plugin) puts 12 Step Meeting List's own page straight back.
 * ----------------------------------------------------------------------------------------- */

function laim_settings()
{
    $s = get_option('laim_settings', []);
    return [
        'takeover' => !empty($s['takeover']),
        'singles' => !isset($s['singles']) || !empty($s['singles']),
        'heading' => isset($s['heading']) ? (string) $s['heading'] : 'Find a Meeting',
        'atts' => isset($s['atts']) ? (string) $s['atts'] : '',
    ];
}

/** Admins can see the new page at /meetings/?laipreview=1 before it is switched on. */
function laim_is_preview()
{
    return isset($_GET['laipreview']) && current_user_can('manage_options'); // phpcs:ignore WordPress.Security.NonceVerification
}

function laim_should_take_over()
{
    return laim_settings()['takeover'] || laim_is_preview();
}

/*
 * Block themes (like Portia) don't use archive_template / single_template for their own
 * templates, so take over at template_include, which every theme goes through.
 */
add_filter('template_include', function ($template) {
    if (!laim_should_take_over()) {
        return $template;
    }
    if (is_post_type_archive('tsml_meeting')) {
        return __DIR__ . '/templates/meetings-page.php';
    }
    if (is_singular('tsml_meeting') && laim_settings()['singles']) {
        return __DIR__ . '/templates/meetings-page.php';
    }
    return $template;
}, 99);

/** The finder for the /meetings page, with the defaults from Settings. */
function laim_page_finder()
{
    $atts = shortcode_parse_atts(laim_settings()['atts']);
    $atts = is_array($atts) ? $atts : [];
    if (is_singular('tsml_meeting')) {
        $atts['open'] = (string) get_queried_object_id();
    }
    return laim_shortcode($atts);
}

add_action('admin_menu', function () {
    add_options_page('LAI Meeting Finder', 'LAI Meeting Finder', 'manage_options', 'laim', 'laim_settings_page');
});

add_action('admin_init', function () {
    register_setting('laim', 'laim_settings', [
        'type' => 'array',
        'sanitize_callback' => function ($v) {
            $v = (array) $v;
            return [
                'takeover' => !empty($v['takeover']) ? 1 : 0,
                'singles' => !empty($v['singles']) ? 1 : 0,
                'heading' => sanitize_text_field(isset($v['heading']) ? $v['heading'] : ''),
                'atts' => sanitize_text_field(wp_unslash(isset($v['atts']) ? str_replace(['“', '”', '″'], '"', $v['atts']) : '')),
            ];
        },
    ]);
});

function laim_settings_page()
{
    $s = laim_settings();
    $url = function_exists('tsml_meetings_url') ? tsml_meetings_url() : home_url('/meetings/');
    ?>
    <div class="wrap">
        <h1>LAI Meeting Finder</h1>
        <p>Use the shortcode <code>[lai_meetings]</code> on any page, or let this finder show at <a href="<?php echo esc_url($url); ?>" target="_blank"><?php echo esc_html($url); ?></a> in place of the 12 Step Meeting List page.</p>
        <p><strong>Try it first:</strong> <a href="<?php echo esc_url(add_query_arg('laipreview', '1', $url)); ?>" target="_blank">open the meetings page with the new finder</a>. Only logged-in admins see this preview.</p>
        <form method="post" action="options.php">
            <?php settings_fields('laim'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">Meetings page</th>
                    <td>
                        <label><input type="checkbox" name="laim_settings[takeover]" value="1" <?php checked($s['takeover']); ?>> Show this finder at <?php echo esc_html(wp_parse_url($url, PHP_URL_PATH)); ?></label>
                        <p class="description">Untick to put the 12 Step Meeting List page back. Meetings, imports, the Meeting Guide feed and every other page stay as they are either way.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Each meeting's page</th>
                    <td>
                        <label><input type="checkbox" name="laim_settings[singles]" value="1" <?php checked($s['singles']); ?>> Also use it for each meeting's own page (opens the finder on that meeting)</label>
                        <p class="description">Meeting addresses (such as /meetings/meeting-name/) stay the same, so old links and bookmarks still work.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="laim-heading">Page heading</label></th>
                    <td><input type="text" class="regular-text" id="laim-heading" name="laim_settings[heading]" value="<?php echo esc_attr($s['heading']); ?>">
                        <p class="description">Leave empty for no heading.</p></td>
                </tr>
                <tr>
                    <th scope="row"><label for="laim-atts">Options</label></th>
                    <td><input type="text" class="regular-text code" id="laim-atts" name="laim_settings[atts]" value="<?php echo esc_attr($s['atts']); ?>" placeholder='day="today" map_style="positron"'>
                        <p class="description">The same options as the shortcode, for example <code>day="any"</code> or <code>view="map"</code>.</p></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
