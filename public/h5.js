(()=>{
 'use strict';
 const root=document.documentElement,viewport=window.visualViewport;
 let frame;
 function viewportSize(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
  root.style.setProperty('--h5-height',`${viewport?.height||innerHeight}px`);
  root.style.setProperty('--h5-top',`${viewport?.offsetTop||0}px`);
 })}
 function sync(){
  document.body.classList.toggle('h5-conversation',!!document.querySelector('.chat-layout.has-conversation'));
  const menu=document.querySelector('[data-action="menu"]');menu?.setAttribute('aria-expanded',String(document.body.classList.contains('mobile-menu')));
  viewportSize();
 }
 new MutationObserver(sync).observe(document.getElementById('app'),{childList:true});
 document.addEventListener('input',e=>{if(!e.target.matches('.composer textarea'))return;const area=e.target;area.style.height='46px';area.style.height=Math.min(120,area.scrollHeight)+'px'});
 document.addEventListener('click',()=>requestAnimationFrame(sync));
 viewport?.addEventListener('resize',viewportSize);viewport?.addEventListener('scroll',viewportSize);window.addEventListener('resize',viewportSize);
 sync();
})();
