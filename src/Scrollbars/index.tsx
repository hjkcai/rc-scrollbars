import * as React from 'react';
import { Component, CSSProperties } from 'react';
import raf, { cancel as caf } from 'raf';
import css from 'dom-css';
//
import { ScrollValues, ScrollbarsProps, StyleKeys } from './types';
import {
  getFinalClasses,
  getScrollbarWidth,
  returnFalse,
  getInnerWidth,
  getInnerHeight,
} from '../utils';
import { createStyles } from './styles';

interface State {
  didMountUniversal: boolean;
  scrollbarWidth: number;
}

export class Scrollbars extends Component<ScrollbarsProps, State> {
  container: Element | null = null;
  detectScrollingInterval: any; // Node timeout bug
  dragging: boolean = false;
  hideTracksTimeout: any; // Node timeout bug
  lastViewScrollLeft?: number;
  lastViewScrollTop?: number;
  prevPageX?: number;
  prevPageY?: number;
  requestFrame?: number;
  scrolling: boolean = false;
  styles: Record<StyleKeys, CSSProperties>;
  thumbHorizontal?: HTMLDivElement;
  thumbVertical?: HTMLDivElement;
  trackHorizontal?: HTMLDivElement;
  trackMouseOver: boolean = false;
  trackVertical?: HTMLDivElement;
  view?: HTMLElement;
  viewScrollLeft?: number;
  viewScrollTop?: number;
  mutationOb = new MutationObserver(() => this.update());
  updateCallbacks: Array<(values: ScrollValues) => void> = [];

  static displayName = 'Scrollbars';
  static defaultProps = {
    autoHeight: false,
    autoHeightMax: 200,
    autoHeightMin: 0,
    autoHide: false,
    autoHideDuration: 200,
    autoHideTimeout: 1000,
    disableDefaultStyles: false,
    hideTracksWhenNotNeeded: false,
    renderThumbHorizontal: (props) => <div {...props} />,
    renderThumbVertical: (props) => <div {...props} />,
    renderTrackHorizontal: (props) => <div {...props} />,
    renderTrackVertical: (props) => <div {...props} />,
    renderView: (props) => <div {...props} />,
    tagName: 'div',
    thumbMinSize: 30,
    universal: false,
  };

  constructor(props: ScrollbarsProps) {
    super(props);

    this.styles = createStyles(this.props.disableDefaultStyles);

    this.getScrollLeft = this.getScrollLeft.bind(this);
    this.getScrollTop = this.getScrollTop.bind(this);
    this.getScrollWidth = this.getScrollWidth.bind(this);
    this.getScrollHeight = this.getScrollHeight.bind(this);
    this.getClientWidth = this.getClientWidth.bind(this);
    this.getClientHeight = this.getClientHeight.bind(this);
    this.getValues = this.getValues.bind(this);
    this.getThumbHorizontalWidth = this.getThumbHorizontalWidth.bind(this);
    this.getThumbVerticalHeight = this.getThumbVerticalHeight.bind(this);
    this.getScrollLeftForOffset = this.getScrollLeftForOffset.bind(this);
    this.getScrollTopForOffset = this.getScrollTopForOffset.bind(this);

    this.scrollLeft = this.scrollLeft.bind(this);
    this.scrollTop = this.scrollTop.bind(this);
    this.scrollToLeft = this.scrollToLeft.bind(this);
    this.scrollToTop = this.scrollToTop.bind(this);
    this.scrollToRight = this.scrollToRight.bind(this);
    this.scrollToBottom = this.scrollToBottom.bind(this);

    this.handleTrackMouseEnter = this.handleTrackMouseEnter.bind(this);
    this.handleTrackMouseLeave = this.handleTrackMouseLeave.bind(this);
    this.handleHorizontalTrackMouseDown = this.handleHorizontalTrackMouseDown.bind(this);
    this.handleVerticalTrackMouseDown = this.handleVerticalTrackMouseDown.bind(this);
    this.handleHorizontalThumbMouseDown = this.handleHorizontalThumbMouseDown.bind(this);
    this.handleVerticalThumbMouseDown = this.handleVerticalThumbMouseDown.bind(this);
    this.handleHorizontalTrackWheel = this.handleHorizontalTrackWheel.bind(this);
    this.handleVerticalTrackWheel = this.handleVerticalTrackWheel.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);

    this.state = {
      didMountUniversal: false,
      scrollbarWidth: getScrollbarWidth(),
    };
  }

  componentDidMount() {
    this.addListeners();
    this.update();
    this.componentDidMountUniversal();
  }

  componentDidMountUniversal() {
    // eslint-disable-line react/sort-comp
    const { universal } = this.props;
    if (!universal) return;
    this.setState({ didMountUniversal: true });
  }

  componentDidUpdate() {
    this.update();
  }

  componentWillUnmount() {
    this.removeListeners();
    this.requestFrame && caf(this.requestFrame);
    clearTimeout(this.hideTracksTimeout);
    clearInterval(this.detectScrollingInterval);
  }

  getScrollLeft() {
    if (!this.view) return 0;
    return this.view.scrollLeft;
  }

  getScrollTop() {
    if (!this.view) return 0;
    return this.view.scrollTop;
  }

  getScrollWidth() {
    if (!this.view) return 0;
    return this.view.scrollWidth;
  }

  getScrollHeight() {
    if (!this.view) return 0;
    return this.view.scrollHeight;
  }

  getClientWidth() {
    if (!this.view) return 0;
    return this.view.clientWidth;
  }

  getClientHeight() {
    if (!this.view) return 0;
    return this.view.clientHeight;
  }

  getValues() {
    const {
      scrollLeft = 0,
      scrollTop = 0,
      scrollWidth = 0,
      scrollHeight = 0,
      clientWidth = 0,
      clientHeight = 0,
    } = this.view || {};

    return {
      left: scrollLeft / (scrollWidth - clientWidth) || 0,
      top: scrollTop / (scrollHeight - clientHeight) || 0,
      scrollLeft,
      scrollTop,
      scrollWidth,
      scrollHeight,
      clientWidth,
      clientHeight,
    };
  }

  getThumbHorizontalWidth() {
    if (!this.view || !this.trackHorizontal) return 0;
    const { thumbSize, thumbMinSize } = this.props;
    const { scrollWidth, clientWidth } = this.view;
    const trackWidth = getInnerWidth(this.trackHorizontal);
    const width = Math.ceil((clientWidth / scrollWidth) * trackWidth);
    if (trackWidth === width) return 0;
    if (thumbSize) return thumbSize;
    return Math.max(width, thumbMinSize);
  }

  getThumbVerticalHeight() {
    if (!this.view || !this.trackVertical) return 0;
    const { thumbSize, thumbMinSize } = this.props;
    const { scrollHeight, clientHeight } = this.view;
    const trackHeight = getInnerHeight(this.trackVertical);
    const height = Math.ceil((clientHeight / scrollHeight) * trackHeight);
    if (trackHeight === height) return 0;
    if (thumbSize) return thumbSize;
    return Math.max(height, thumbMinSize);
  }

  getScrollLeftForOffset(offset) {
    if (!this.view || !this.trackHorizontal) return 0;
    const { scrollWidth, clientWidth } = this.view;
    const trackWidth = getInnerWidth(this.trackHorizontal);
    const thumbWidth = this.getThumbHorizontalWidth();
    return (offset / (trackWidth - thumbWidth)) * (scrollWidth - clientWidth);
  }

  getScrollTopForOffset(offset) {
    if (!this.view || !this.trackVertical) return 0;
    const { scrollHeight, clientHeight } = this.view;
    const trackHeight = getInnerHeight(this.trackVertical);
    const thumbHeight = this.getThumbVerticalHeight();
    return (offset / (trackHeight - thumbHeight)) * (scrollHeight - clientHeight);
  }

  scrollLeft(left = 0) {
    if (!this.view) return;
    this.view.scrollLeft = left;
  }

  scrollTop(top = 0) {
    if (!this.view) return;
    this.view.scrollTop = top;
  }

  scrollToLeft() {
    if (!this.view) return;
    this.view.scrollLeft = 0;
  }

  scrollToTop() {
    if (!this.view) return;
    this.view.scrollTop = 0;
  }

  scrollToRight() {
    if (!this.view) return;
    this.view.scrollLeft = this.view.scrollWidth;
  }

  scrollToBottom() {
    if (!this.view) return;
    this.view.scrollTop = this.view.scrollHeight;
  }

  scrollToY(y: number) {
    if (!this.view) return;
    this.view.scrollTop = y;
  }

  addListeners() {
    /* istanbul ignore if */
    if (
      typeof document === 'undefined' ||
      !this.view ||
      !this.trackHorizontal ||
      !this.trackVertical ||
      !this.thumbVertical ||
      !this.thumbHorizontal
    )
      return;

    const { view, trackHorizontal, trackVertical, thumbHorizontal, thumbVertical } = this;
    view.addEventListener('scroll', this.handleScroll);

    if (!this.state.scrollbarWidth) return;

    trackHorizontal.addEventListener('mouseenter', this.handleTrackMouseEnter);
    trackHorizontal.addEventListener('mouseleave', this.handleTrackMouseLeave);
    trackHorizontal.addEventListener('mousedown', this.handleHorizontalTrackMouseDown);
    trackVertical.addEventListener('mouseenter', this.handleTrackMouseEnter);
    trackVertical.addEventListener('mouseleave', this.handleTrackMouseLeave);
    trackVertical.addEventListener('mousedown', this.handleVerticalTrackMouseDown);
    thumbHorizontal.addEventListener('mousedown', this.handleHorizontalThumbMouseDown);
    thumbVertical.addEventListener('mousedown', this.handleVerticalThumbMouseDown);
    trackHorizontal.addEventListener('wheel', this.handleHorizontalTrackWheel);
    trackVertical.addEventListener('wheel', this.handleVerticalTrackWheel);
    window.addEventListener('resize', this.handleWindowResize);
    this.mutationOb.observe(view, { attributes: true, childList: true, subtree: true });
  }

  removeListeners() {
    /* istanbul ignore if */
    if (
      typeof document === 'undefined' ||
      !this.view ||
      !this.trackHorizontal ||
      !this.trackVertical ||
      !this.thumbVertical ||
      !this.thumbHorizontal
    )
      return;
    const { view, trackHorizontal, trackVertical, thumbHorizontal, thumbVertical } = this;
    view.removeEventListener('scroll', this.handleScroll);

    if (!this.state.scrollbarWidth) return;

    trackHorizontal.removeEventListener('mouseenter', this.handleTrackMouseEnter);
    trackHorizontal.removeEventListener('mouseleave', this.handleTrackMouseLeave);
    trackHorizontal.removeEventListener('mousedown', this.handleHorizontalTrackMouseDown);
    trackVertical.removeEventListener('mouseenter', this.handleTrackMouseEnter);
    trackVertical.removeEventListener('mouseleave', this.handleTrackMouseLeave);
    trackVertical.removeEventListener('mousedown', this.handleVerticalTrackMouseDown);
    thumbHorizontal.removeEventListener('mousedown', this.handleHorizontalThumbMouseDown);
    thumbVertical.removeEventListener('mousedown', this.handleVerticalThumbMouseDown);
    trackHorizontal.removeEventListener('wheel', this.handleHorizontalTrackWheel);
    trackVertical.removeEventListener('wheel', this.handleVerticalTrackWheel);
    window.removeEventListener('resize', this.handleWindowResize);
    // Possibly setup by `handleDragStart`
    this.teardownDragging();
    this.mutationOb.disconnect();
  }

  handleScroll(event) {
    const { onScroll, onScrollFrame } = this.props;
    if (onScroll) onScroll(event);
    this.update((values: ScrollValues) => {
      const { scrollLeft, scrollTop } = values;
      this.viewScrollLeft = scrollLeft;
      this.viewScrollTop = scrollTop;
      if (onScrollFrame) onScrollFrame(values);
    });
    this.detectScrolling();
  }

  handleScrollStart() {
    const { onScrollStart } = this.props;
    if (onScrollStart) onScrollStart();
    this.handleScrollStartAutoHide();
  }

  handleScrollStartAutoHide() {
    const { autoHide } = this.props;
    if (!autoHide) return;
    this.showTracks();
  }

  handleScrollStop() {
    const { onScrollStop } = this.props;
    if (onScrollStop) onScrollStop();
    this.handleScrollStopAutoHide();
  }

  handleScrollStopAutoHide() {
    const { autoHide } = this.props;
    if (!autoHide) return;
    this.hideTracks();
  }

  handleWindowResize() {
    this.update();
  }

  handleHorizontalTrackMouseDown(event) {
    if (!this.view) return;
    event.preventDefault();
    const { target, clientX } = event;
    const { left: targetLeft } = target.getBoundingClientRect();
    const thumbWidth = this.getThumbHorizontalWidth();
    const offset = Math.abs(targetLeft - clientX) - thumbWidth / 2;
    this.view.scrollLeft = this.getScrollLeftForOffset(offset);

    this.update(() => {
      this.handleDragStart(event);
      const { left, width } = this.thumbHorizontal!.getBoundingClientRect();
      this.prevPageY = width - (event.clientX - left);
    });
  }

  handleVerticalTrackMouseDown(event) {
    if (!this.view) return;
    event.preventDefault();
    const { target, clientY } = event;
    const { top: targetTop } = target.getBoundingClientRect();
    const thumbHeight = this.getThumbVerticalHeight();
    const offset = Math.abs(targetTop - clientY) - thumbHeight / 2;
    this.view.scrollTop = this.getScrollTopForOffset(offset);

    this.update(() => {
      this.handleDragStart(event);
      const { top, height } = this.thumbVertical!.getBoundingClientRect();
      this.prevPageY = height - (event.clientY - top);
    });
  }

  handleHorizontalThumbMouseDown(event) {
    event.preventDefault();
    this.handleDragStart(event);
    const { target, clientX } = event;
    const { offsetWidth } = target;
    const { left } = target.getBoundingClientRect();
    this.prevPageX = offsetWidth - (clientX - left);
  }

  handleVerticalThumbMouseDown(event) {
    event.preventDefault();
    this.handleDragStart(event);
    const { target, clientY } = event;
    const { offsetHeight } = target;
    const { top } = target.getBoundingClientRect();
    this.prevPageY = offsetHeight - (clientY - top);
  }

  handleHorizontalTrackWheel(e: WheelEvent) {
    e.preventDefault();
    this.scrollLeft(this.getScrollLeft() + e.deltaX);
  }

  handleVerticalTrackWheel(e: WheelEvent) {
    e.preventDefault();
    this.scrollTop(this.getScrollTop() + e.deltaY);
  }

  setupDragging() {
    css(document.body, this.styles.disableSelectStyle);
    document.addEventListener('mousemove', this.handleDrag);
    document.addEventListener('mouseup', this.handleDragEnd);
    document.onselectstart = returnFalse;
  }

  teardownDragging() {
    css(document.body, this.styles.disableSelectStyleReset);
    document.removeEventListener('mousemove', this.handleDrag);
    document.removeEventListener('mouseup', this.handleDragEnd);
    document.onselectstart = null;
  }

  handleDragStart(event) {
    this.dragging = true;
    event.stopImmediatePropagation();
    this.setupDragging();
  }

  handleDrag(event) {
    if (this.prevPageX && this.trackHorizontal && this.view) {
      const { clientX } = event;
      const { left: trackLeft } = this.trackHorizontal.getBoundingClientRect();
      const thumbWidth = this.getThumbHorizontalWidth();
      const clickPosition = thumbWidth - this.prevPageX;
      const offset = -trackLeft + clientX - clickPosition;
      this.view.scrollLeft = this.getScrollLeftForOffset(offset);
    }
    if (this.prevPageY && this.trackVertical && this.view) {
      const { clientY } = event;
      const { top: trackTop } = this.trackVertical.getBoundingClientRect();
      const thumbHeight = this.getThumbVerticalHeight();
      const clickPosition = thumbHeight - this.prevPageY;
      const offset = -trackTop + clientY - clickPosition;
      this.view.scrollTop = this.getScrollTopForOffset(offset);
    }
    return false;
  }

  handleDragEnd() {
    this.dragging = false;
    this.prevPageX = this.prevPageY = 0;
    this.teardownDragging();
    this.handleDragEndAutoHide();
  }

  handleDragEndAutoHide() {
    const { autoHide } = this.props;
    if (!autoHide) return;
    this.hideTracks();
  }

  handleTrackMouseEnter() {
    this.trackMouseOver = true;
    this.handleTrackMouseEnterAutoHide();
  }

  handleTrackMouseEnterAutoHide() {
    const { autoHide } = this.props;
    if (!autoHide) return;
    this.showTracks();
  }

  handleTrackMouseLeave() {
    this.trackMouseOver = false;
    this.handleTrackMouseLeaveAutoHide();
  }

  handleTrackMouseLeaveAutoHide() {
    const { autoHide } = this.props;
    if (!autoHide) return;
    this.hideTracks();
  }

  showTracks() {
    if (this.hideTracksTimeout) {
      clearTimeout(this.hideTracksTimeout);
      this.hideTracksTimeout = undefined;
    }
    if (this.trackHorizontal && this.trackHorizontal.style.opacity !== '1') {
      this.trackHorizontal.style.opacity = '1';
    }
    if (this.trackVertical && this.trackVertical.style.opacity !== '1') {
      this.trackVertical.style.opacity = '1';
    }
  }

  hideTracks() {
    if (this.dragging) return;
    if (this.scrolling) return;
    if (this.trackMouseOver) return;
    const { autoHideTimeout } = this.props;
    if (this.hideTracksTimeout) clearTimeout(this.hideTracksTimeout);
    this.hideTracksTimeout = setTimeout(() => {
      if (this.trackHorizontal && this.trackHorizontal.style.opacity !== '0') {
        this.trackHorizontal.style.opacity = '0';
      }
      if (this.trackVertical && this.trackVertical.style.opacity !== '0') {
        this.trackVertical.style.opacity = '0';
      }
    }, autoHideTimeout);
  }

  detectScrolling() {
    if (this.scrolling) return;
    this.scrolling = true;
    this.handleScrollStart();
    this.detectScrollingInterval = setInterval(() => {
      if (
        this.lastViewScrollLeft === this.viewScrollLeft &&
        this.lastViewScrollTop === this.viewScrollTop
      ) {
        clearInterval(this.detectScrollingInterval);
        this.scrolling = false;
        this.handleScrollStop();
      }
      this.lastViewScrollLeft = this.viewScrollLeft;
      this.lastViewScrollTop = this.viewScrollTop;
    }, 100);
  }

  update(callback?: (values: ScrollValues) => void) {
    if (this.requestFrame) return;
    if (typeof callback === 'function') this.updateCallbacks.push(callback);
    this.requestFrame = raf(() => {
      this.requestFrame = undefined;
      this._update();
    });
  }

  _update() {
    const { onUpdate, hideTracksWhenNotNeeded } = this.props;
    const values = this.getValues();

    const freshScrollbarWidth = getScrollbarWidth();

    if (this.state.scrollbarWidth !== freshScrollbarWidth) {
      this.setState({ scrollbarWidth: freshScrollbarWidth });
    }

    if (this.state.scrollbarWidth) {
      const { scrollLeft, clientWidth, scrollWidth } = values;
      const trackHorizontalWidth = getInnerWidth(this.trackHorizontal);

      const thumbHorizontalWidth = this.getThumbHorizontalWidth();
      const thumbHorizontalX =
        (scrollLeft / (scrollWidth - clientWidth)) * (trackHorizontalWidth - thumbHorizontalWidth);
      const thumbHorizontalStyle = {
        width: thumbHorizontalWidth,
        transform: `translateX(${thumbHorizontalX}px)`,
      };
      const { scrollTop, clientHeight, scrollHeight } = values;
      const trackVerticalHeight = getInnerHeight(this.trackVertical);
      const thumbVerticalHeight = this.getThumbVerticalHeight();
      const thumbVerticalY =
        (scrollTop / (scrollHeight - clientHeight)) * (trackVerticalHeight - thumbVerticalHeight);
      const thumbVerticalStyle = {
        height: thumbVerticalHeight,
        transform: `translateY(${thumbVerticalY}px)`,
      };
      if (hideTracksWhenNotNeeded) {
        const trackHorizontalStyle = {
          visibility: scrollWidth > clientWidth ? 'visible' : 'hidden',
        };
        const trackVerticalStyle = {
          visibility: scrollHeight > clientHeight ? 'visible' : 'hidden',
        };
        css(this.trackHorizontal, trackHorizontalStyle);
        css(this.trackVertical, trackVerticalStyle);
      }
      css(this.thumbHorizontal, thumbHorizontalStyle);
      css(this.thumbVertical, thumbVerticalStyle);
    }

    if (onUpdate) onUpdate(values);

    if (this.updateCallbacks.length > 0) {
      for (let i = 0; i < this.updateCallbacks.length; i++) {
        this.updateCallbacks[i](values);
      }

      this.updateCallbacks = [];
    }
  }

  render() {
    const { scrollbarWidth, didMountUniversal } = this.state;

    const {
      autoHeight,
      autoHeightMax,
      autoHeightMin,
      children,
      renderThumbHorizontal,
      renderThumbVertical,
      renderTrackHorizontal,
      renderTrackVertical,
      renderView,
      style,
      tagName,
      universal,
      id,
    } = this.props;

    const Tag = tagName as 'div';

    const {
      containerStyleAutoHeight,
      containerStyleDefault,
      viewStyleAutoHeight,
      viewStyleDefault,
      viewStyleUniversalInitial,
    } = this.styles;

    const containerStyle = (() => {
      const result = { ...containerStyleDefault };
      if (autoHeight) {
        Object.assign(result, containerStyleAutoHeight);
        result.minHeight = autoHeightMin;
        result.maxHeight = autoHeightMax;
      }

      return Object.assign(result, style);
    })();

    const viewStyle = (() => {
      const result = {
        ...viewStyleDefault,
        // Hide scrollbars by setting a negative margin
        marginRight: scrollbarWidth ? -scrollbarWidth : 0,
        marginBottom: scrollbarWidth ? -scrollbarWidth : 0,
      };

      if (autoHeight) {
        Object.assign(result, viewStyleAutoHeight);

        if (universal && !didMountUniversal) {
          // Override min/max height for initial universal rendering
          result.minHeight = autoHeightMin;
          result.maxHeight = autoHeightMax;
        } else {
          // Add scrollbarWidth to autoHeight in order to compensate negative margins
          result.minHeight =
            typeof autoHeightMin === 'string'
              ? `calc(${autoHeightMin} + ${scrollbarWidth}px)`
              : autoHeightMin + scrollbarWidth;
          result.maxHeight =
            typeof autoHeightMax === 'string'
              ? `calc(${autoHeightMax} + ${scrollbarWidth}px)`
              : autoHeightMax + scrollbarWidth;
        }
      }

      return universal && !didMountUniversal
        ? Object.assign(result, viewStyleUniversalInitial) // Override
        : result;
    })();

    let trackStyle: React.CSSProperties | undefined;
    if (!scrollbarWidth || (universal && !didMountUniversal)) {
      trackStyle = {
        display: 'none',
      };
    }

    const mergedClasses = getFinalClasses(this.props);

    return (
      <Tag
        ref={(ref) => {
          this.container = ref;
        }}
        id={id}
        className={mergedClasses.root}
        style={containerStyle}
      >
        {renderView({
          ref: (ref) => {
            this.view = ref!;
          },
          style: viewStyle,
          className: mergedClasses.view,
          children,
        })}
        {renderTrackHorizontal({
          ref: (ref) => {
            this.trackHorizontal = ref!;
          },
          className: mergedClasses.trackHorizontal,
          style: trackStyle,
          children: renderThumbHorizontal({
            ref: (ref) => {
              this.thumbHorizontal = ref!;
            },
            className: mergedClasses.thumbHorizontal,
          }),
        })}
        {renderTrackVertical({
          ref: (ref) => {
            this.trackVertical = ref!;
          },
          className: mergedClasses.trackVertical,
          style: trackStyle,
          children: renderThumbVertical({
            ref: (ref) => {
              this.thumbVertical = ref!;
            },
            className: mergedClasses.thumbVertical,
          }),
        })}
      </Tag>
    );
  }
}
