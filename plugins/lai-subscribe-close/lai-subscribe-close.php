<?php
/**
 * Plugin Name: LAI Subscribe Button Close
 * Description: Adds a small "×" to Jetpack's floating Subscribe button so visitors can close it. Once closed it stays hidden for that visitor for 30 days (remembered in their browser only). Changes nothing else.
 * Version: 1.0.0
 * Author: Lancaster Area Intergroup
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* Early: hide the button before it paints if this visitor closed it in the last 30 days. */
add_action(
	'wp_head',
	function () {
		?>
<script>try{var t=+localStorage.getItem('laiSubClosed');if(t&&Date.now()-t<2592e6){document.documentElement.classList.add('lai-sub-hidden');}}catch(e){}</script>
<style>
.lai-sub-hidden .jetpack-subscribe-floating-button{display:none!important}
.jetpack-subscribe-floating-button .lai-sub-close{position:absolute;top:6px;right:6px;z-index:2;width:32px;height:32px;padding:0;margin:0;border:2px solid #F2EADE;border-radius:50%;background:#0C203B;color:#F2EADE;font:600 20px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.jetpack-subscribe-floating-button .lai-sub-close:hover{background:#876343}
.jetpack-subscribe-floating-button .lai-sub-close:focus-visible{outline:3px solid #6aa6ff;outline-offset:2px}
</style>
		<?php
	},
	1
);

/* Late: add the × to the button. */
add_action(
	'wp_footer',
	function () {
		?>
<script>
(function(){
	function add(){
		var box=document.querySelector('.jetpack-subscribe-floating-button');
		if(!box||box.querySelector('.lai-sub-close'))return;
		if(getComputedStyle(box).position==='static'){box.style.position='relative';}
		var b=document.createElement('button');
		b.type='button';b.className='lai-sub-close';b.setAttribute('aria-label','Close the subscribe button');b.textContent='×';
		b.addEventListener('click',function(e){
			e.preventDefault();e.stopPropagation();
			document.documentElement.classList.add('lai-sub-hidden');
			try{localStorage.setItem('laiSubClosed',String(Date.now()));}catch(err){}
		});
		box.appendChild(b);
	}
	if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add);}else{add();}
})();
</script>
		<?php
	},
	99
);
