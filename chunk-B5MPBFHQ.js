import{H as v,J as S,K as C,L as r}from"./chunk-YFEJXRFE.js";import{aa as b,g as k}from"./chunk-V6XIDGU7.js";import{Ob as h,P as d,Pb as g,S as c,U as o,Yb as y,Za as p,bb as m,cb as u,jb as f,ma as l}from"./chunk-NVCWASPR.js";import{a as s,b as a}from"./chunk-4CLCTAJ7.js";var I=`
    .p-skeleton {
        display: block;
        overflow: hidden;
        background: dt('skeleton.background');
        border-radius: dt('skeleton.border.radius');
    }

    .p-skeleton::after {
        content: '';
        animation: p-skeleton-animation 1.2s infinite;
        height: 100%;
        left: 0;
        position: absolute;
        right: 0;
        top: 0;
        transform: translateX(-100%);
        z-index: 1;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0), dt('skeleton.animation.background'), rgba(255, 255, 255, 0));
    }

    [dir='rtl'] .p-skeleton::after {
        animation-name: p-skeleton-animation-rtl;
    }

    .p-skeleton-circle {
        border-radius: 50%;
    }

    .p-skeleton-animation-none::after {
        animation: none;
    }

    @keyframes p-skeleton-animation {
        from {
            transform: translateX(-100%);
        }
        to {
            transform: translateX(100%);
        }
    }

    @keyframes p-skeleton-animation-rtl {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(-100%);
        }
    }
`;var D={root:{position:"relative"}},E={root:({instance:e})=>["p-skeleton p-component",{"p-skeleton-circle":e.shape==="circle","p-skeleton-animation-none":e.animation==="none"}]},M=(()=>{class e extends v{name="skeleton";style=I;classes=E;inlineStyles=D;static \u0275fac=(()=>{let n;return function(t){return(n||(n=l(e)))(t||e)}})();static \u0275prov=d({token:e,factory:e.\u0275fac})}return e})();var w=new c("SKELETON_INSTANCE"),q=(()=>{class e extends C{$pcSkeleton=o(w,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=o(r,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}styleClass;shape="rectangle";animation="wave";borderRadius;size;width="100%";height="1rem";_componentStyle=o(M);get containerStyle(){let n=this._componentStyle?.inlineStyles.root,i;return this.size?i=a(s({},n),{width:this.size,height:this.size,borderRadius:this.borderRadius}):i=a(s({},n),{width:this.width,height:this.height,borderRadius:this.borderRadius}),i}static \u0275fac=(()=>{let n;return function(t){return(n||(n=l(e)))(t||e)}})();static \u0275cmp=p({type:e,selectors:[["p-skeleton"]],hostVars:5,hostBindings:function(i,t){i&2&&(f("aria-hidden",!0),h(t.containerStyle),g(t.cn(t.cx("root"),t.styleClass)))},inputs:{styleClass:"styleClass",shape:"shape",animation:"animation",borderRadius:"borderRadius",size:"size",width:"width",height:"height"},features:[y([M,{provide:w,useExisting:e},{provide:S,useExisting:e}]),u([r]),m],decls:0,vars:0,template:function(i,t){},dependencies:[k,b],encapsulation:2,changeDetection:0})}return e})();export{q as a};
