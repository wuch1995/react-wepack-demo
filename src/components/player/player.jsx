import React, { Component } from 'react'
import { connect } from 'react-redux'
import { CSSTransition, TransitionGroup, Transition } from 'react-transition-group'
import './player.styl'
import Cd from './cd'
import MiniPlayer from './mini-player'
import { setFullScreen, setCurrentIndex, setCurrentSong, setPlayingState } from 'store/actions'
import { is } from 'immutable'
import Lyric from 'lyric-parser'
import animations from 'create-keyframe-animation'

const timeExp = /\[(\d{2}):(\d{2}):(\d{2})]/g
const duration = 300

const defaultStyle = {
  transition: `opacity ${duration}ms ease-in-out`,
  opacity: 0
}

const transitionStyles = {
  entering: { opacity: 0 },
  entered:  { opacity: 1 },
}

class Player extends Component {
  constructor () {
    super()
    this.state = {
      currentTime: 0,
      radius: 32
    }
    this.playingLyric = ''
    this.isPureMusic = false
    this.pureMusicLyric = ''
    this.currentLyric = null
    this.currentLineNum = 0
    this.back = this.back.bind(this)
    this.ready = this.ready.bind(this)
    this.prev = this.prev.bind(this)
    this.next = this.next.bind(this)
    this.togglePlaying = this.togglePlaying.bind(this)
    this.end = this.end.bind(this)
    this.updateTime = this.updateTime.bind(this)
    this.resetPercent = this.resetPercent.bind(this)
    this.getLyric = this.getLyric.bind(this)
    this.lyricScrollEl = this.lyricScrollEl.bind(this)
    this.lyricEl = this.lyricEl.bind(this)
    this.handleLyric = this.handleLyric.bind(this)
    this.onEnter = this.onEnter.bind(this)
    this.onExit = this.onExit.bind(this)
    this.onEntered = this.onEntered.bind(this)
  }
  componentDidMount () {
    this.timer = null
    this.songReady = false
  }
  componentWillReceiveProps (nextProps) {
    if (!is(this.props.currentSong, nextProps.currentSong)) {
      if (!nextProps.currentSong.id || !nextProps.currentSong.url || nextProps.currentSong.id === this.props.currentSong.id) {
        return
      }
      this.songReady = false
      this.canLyricPlay = false
      if (this.currentLyric) {
        this.currentLyric.stop()
        // 重置为null
        this.currentLyric = null
        this.currentTime = 0
        this.playingLyric = ''
        this.currentLineNum = 0
      }
      this.audio.src = nextProps.currentSong.url
      this.audio.play()
      this.getLyric(nextProps.currentSong)
    }
    if (this.props.playing !== nextProps.playing) {
      if (!this.songReady) {
        return
      }
      setTimeout(() => {
        nextProps.playing ? this.audio.play() : this.audio.pause()
      }, 20)
    }
  }
  back () {
    this.props.setFullScreen(false)
  }
  ready () {
    clearTimeout(this.timer)
    this.songReady = true
    this.canLyricPlay = true
    if (this.currentLyric && !this.isPureMusic) {
      this.currentLyric.seek(this.currentTime * 1000)
    }
  }
  next () {
    const { currentIndex, playlist, setCurrentIndex, setCurrentSong, playing } = this.props
    if (!this.songReady) {
      return
    }
    if (playlist.length === 1) {
      this.loop()
    } else {
      let index = currentIndex + 1
      if (index === playlist.length) {
        index = 0
      }
      setCurrentIndex(index)
      setCurrentSong(playlist[index])
      if (!playing) {
        this.togglePlaying()
      }
    }
  }
  prev () {
    const { currentIndex, playlist, setCurrentIndex, setCurrentSong, playing } = this.props
    if (!this.songReady) {
      return
    }
    if (playlist.length === 1) {
      this.loop()
    } else {
      let index = currentIndex - 1
      if (index < 0) {
        index = playlist.length - 1
      }
      setCurrentIndex(index)
      setCurrentSong(playlist[index])
      if (!playing) {
        this.togglePlaying()
      }
    }
  }
  loop () {
    const { setPlayingState } = this.props
    this.audio.play()
    setPlayingState(true)
    if (this.currentLyric) {
      this.currentLyric.seek(0)
    }
  }
  togglePlaying () {
    if (!this.songReady) {
      return
    }
    const { setPlayingState, playing } = this.props
    setPlayingState(!playing)
    if (this.currentLyric) {
      this.currentLyric.togglePlay()
    }
  }
  paused () {
    const { setPlayingState } = this.props
    setPlayingState(false)
    if (this.currentLyric) {
      this.currentLyric.stop()
    }

  }
  end () {
    this.next()
  }
  updateTime (e) {
    this.setState({
      currentTime: e.target.currentTime
    })
    if (this.currentLyric) {
      this.currentLyric.seek(this.state.currentTime * 1000)
    }
  }
  resetPercent (percent) {
    const { currentSong, playing } = this.props
    let currentTime = percent * currentSong.duration
    this.setState({
      currentTime: currentTime
    })
    this.audio.currentTime = currentTime
    if (this.currentLyric) {
      this.currentLyric.seek(currentTime * 1000)
    }
    if (!playing) {
      this.togglePlaying()
    }
  }
  getLyric (currentSong) {
    currentSong.getLyric().then(lyric => {
      if (currentSong.lyric !== lyric) {
        return
      }
      this.currentLyric = new Lyric(lyric, this.handleLyric)
      this.isPureMusic = !this.currentLyric.lines.length
      if (this.isPureMusic) {
        this.pureMusicLyric = this.currentLyric.lrc.replace(timeExp, '').trim()
        this.playingLyric = this.pureMusicLyric
      } else {
        if (this.playing && this.canLyricPlay) {
          // 这个时候有可能用户已经播放了歌曲，要切到对应位置
          this.currentLyric.seek(this.currentTime * 1000)
        }
      }
      this.setState({})
    }).catch((e) => {
      conosl.log(e)
      this.currentLyric = null
      this.playingLyric = ''
      this.currentLineNum = 0
    })
  }
  handleLyric({lineNum, txt}) {
    if (!this.lyricLine) {
      return
    }
    this.currentLineNum = lineNum
    if (lineNum > 5) {
      let lineEl = this.lyricLine.children[lineNum - 5]
      this.lyricList.scrollToElement(lineEl, 1000)
    } else {
      this.lyricList.scrollTo(0, 0, 1000)
    }
    this.playingLyric = txt
  }
  lyricEl (el) {
    this.lyricLine = el
  }
  lyricScrollEl (el) {
    this.lyricList = el
  }
  onEnter (node) {
    let top = node.querySelector('.top')
    let bottom = node.querySelector('.bottom')
    let cdWrapper = node.querySelector('.cd-wrapper')
    const { x, y, scale } = this._getPosAndScale()
    let animation = {
      0: {
        transform: `translate3d(${x}px,${y}px,0) scale(${scale})`
      },
      60: {
        transform: `translate3d(0,0,0) scale(1.1)`
      },
      100: {
        transform: `translate3d(0,0,0) scale(1)`
      }
    }
    animations.registerAnimation({
      name: 'move',
      animation,
      presets: {
        duration: 400,
        easing: 'linear'
      }
    })
    top.style.animation = 'in 0.4s linear'
    bottom.style.animation = 'fade-in 0.4s linear'
    animations.runAnimation(cdWrapper, 'move', () => {})
  }

  onEntered (node) {
    let top = node.querySelector('.top')
    let bottom = node.querySelector('.bottom')
    let cdWrapper = node.querySelector('.cd-wrapper')
    animations.unregisterAnimation('move')
    cdWrapper.style.animation = ''
    top.style.animation = ''
    bottom.style.animation = ''
  }

  onExit (node) {
    let top = node.querySelector('.top')
    let bottom = node.querySelector('.bottom')
    let cdWrapper = node.querySelector('.cd-wrapper')
    top.style.animation = 'out 0.4s linear'
    bottom.style.animation = 'fade-out 0.4s linear'
    cdWrapper.style.transition = 'all 0.4s'
    const { x, y, scale } = this._getPosAndScale()
    cdWrapper.style['transform'] = `translate3d(${x}px,${y}px,0) scale(${scale})`
  }

  _getPosAndScale () {
    const targetWidth = 40
    const paddingLeft = 40
    const paddingBottom = 30
    const paddingTop = 80
    const width = window.innerWidth * 0.8
    const scale = targetWidth / width
    const x = -(window.innerWidth / 2 - paddingLeft)
    const y = window.innerHeight - paddingTop - width / 2 - paddingBottom
    return {
      x,
      y,
      scale
    }
  }
  render () {
    const { fullScreen, playing, currentSong, playlist } = this.props
    const percent = this.state.currentTime / currentSong.duration
    return (
      <div className="player" style={playlist.length > 0 ? {display:'block'} : {display:'none'}}>
      <CSSTransition
        in={fullScreen}
        timeout={400}
        onEnter={this.onEnter}
        onEntered={this.onEntered}
        onExit={this.onExit}
        classNames="fade"
        unmountOnExit
      >
          <Cd
            key="cd"
            currentSong={currentSong}
            currentTime={this.state.currentTime}
            togglePlaying={this.togglePlaying}
            back={this.back}
            prev={this.prev}
            playing={playing}
            percent={percent}
            resetPercent={this.resetPercent}
            next={this.next}
            lyricEl={this.lyricEl}
            lyricScrollEl={this.lyricScrollEl}
            currentLyric={this.currentLyric}
            currentLineNum={this.currentLineNum}
            playingLyric={this.playingLyric}
          >
          </Cd>
      </CSSTransition>
        {
          !fullScreen &&
            <MiniPlayer percent={percent} key="mini" currentSong={currentSong}></MiniPlayer>
        }

          {/* {state => (
            <div style={{
              ...defaultStyle,
              ...transitionStyles[state]
            }}>
              <Cd
                key="cd"
                currentSong={currentSong}
                currentTime={this.state.currentTime}
                togglePlaying={this.togglePlaying}
                back={this.back}
                prev={this.prev}
                playing={playing}
                percent={percent}
                resetPercent={this.resetPercent}
                next={this.next}
                lyricEl={this.lyricEl}
                lyricScrollEl={this.lyricScrollEl}
                currentLyric={this.currentLyric}
                currentLineNum={this.currentLineNum}
                playingLyric={this.playingLyric}
              >
              </Cd>
            </div>
          )} */}
        {/* <Cd
          key="cd"
          currentSong={currentSong}
          currentTime={this.state.currentTime}
          togglePlaying={this.togglePlaying}
          back={this.back}
          prev={this.prev}
          playing={playing}
          percent={percent}
          resetPercent={this.resetPercent}
          next={this.next}
          lyricEl={this.lyricEl}
          lyricScrollEl={this.lyricScrollEl}
          currentLyric={this.currentLyric}
          currentLineNum={this.currentLineNum}
          playingLyric={this.playingLyric}
        >
        </Cd> */}
        {/* <ReactCSSTransitionGroup component="span" transitionName="mini" transitionEnterTimeout={300}
          transitionLeaveTimeout={300}>
          { fullScreen ? null : <MiniPlayer percent={percent} key="mini" currentSong={currentSong}></MiniPlayer> }
        </ReactCSSTransitionGroup> */}
        {/* <MiniPlayer percent={percent} key="mini" currentSong={currentSong}></MiniPlayer> */}
        <audio ref={audio => this.audio = audio} onPlaying={this.ready} onEnded={this.end} onTimeUpdate={e => this.updateTime(e)}></audio>
      </div>
    )
  }
}

const mapStateToProps = (state) => {
  const { playlist, currentIndex, fullScreen, currentSong, playing} = state
  return {
    playlist,
    currentIndex,
    fullScreen,
    currentSong,
    playing
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setFullScreen: (fullscreen) => {
      dispatch(setFullScreen(fullscreen))
    },
    setCurrentIndex: (index) => {
      dispatch(setCurrentIndex(index))
    },
    setCurrentSong: (song) => {
      dispatch(setCurrentSong(song))
    },
    setPlayingState: (state) => {
      dispatch(setPlayingState(state))
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Player)