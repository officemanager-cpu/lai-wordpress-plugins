<?php
/**
 * LAI Meeting Finder: the /meetings page (and, if turned on, each meeting's own page).
 * Uses the same header, footer and widget areas as 12 Step Meeting List's own page.
 */
if (!defined('ABSPATH')) {
    exit;
}
$laim_settings = laim_settings();
function_exists('tsml_header') ? tsml_header() : get_header();
?>
<div class="laim-page">
    <?php if (is_active_sidebar('tsml_meetings_top')) { ?>
        <div class="widgets meetings-widgets meetings-widgets-top" role="complementary"><?php dynamic_sidebar('tsml_meetings_top'); ?></div>
    <?php } ?>

    <?php if ($laim_settings['heading'] !== '') { ?>
        <h1 class="laim-page-title"><?php echo esc_html($laim_settings['heading']); ?></h1>
    <?php } ?>

    <?php echo laim_page_finder(); // phpcs:ignore WordPress.Security.EscapeOutput ?>

    <?php if (is_active_sidebar('tsml_meetings_bottom')) { ?>
        <div class="widgets meetings-widgets meetings-widgets-bottom" role="complementary"><?php dynamic_sidebar('tsml_meetings_bottom'); ?></div>
    <?php } ?>
</div>
<?php
function_exists('tsml_footer') ? tsml_footer() : get_footer();
