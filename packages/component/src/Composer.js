import { Composer as SayComposer } from 'react-say';
import {
  Composer as ScrollToBottomComposer,
  FunctionContext as ScrollToBottomFunctionContext
} from 'react-scroll-to-bottom';

import { css } from 'glamor';
import { Provider } from 'react-redux';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useReferenceGrammarID from './hooks/useReferenceGrammarID';

import {
  clearSuggestedActions,
  connect as createConnectAction,
  createStore,
  disconnect,
  emitTypingIndicator,
  markActivity,
  postActivity,
  sendEvent,
  sendFiles,
  sendMessage,
  sendMessageBack,
  sendPostBack,
  setDictateInterims,
  setDictateState,
  setLanguage,
  setSendBox,
  setSendTimeout,
  setSendTypingIndicator,
  startDictate,
  startSpeakingActivity,
  stopDictate,
  stopSpeakingActivity,
  submitSendBox
} from 'botframework-webchat-core';

import concatMiddleware from './Middleware/concatMiddleware';
import createCoreCardActionMiddleware from './Middleware/CardAction/createCoreMiddleware';
import createStyleSet from './Styles/createStyleSet';
import defaultSelectVoice from './defaultSelectVoice';
import Dictation from './Dictation';
import mapMap from './Utils/mapMap';
import observableToPromise from './Utils/observableToPromise';
import WebChatReduxContext, { useDispatch } from './WebChatReduxContext';
import WebChatUIContext from './WebChatUIContext';

import {
  speechSynthesis as bypassSpeechSynthesis,
  SpeechSynthesisUtterance as BypassSpeechSynthesisUtterance
} from './Speech/BypassSpeechSynthesisPonyfill';

// List of Redux actions factory we are hoisting as Web Chat functions
const DISPATCHERS = {
  clearSuggestedActions,
  emitTypingIndicator,
  markActivity,
  postActivity,
  sendEvent,
  sendFiles,
  sendMessage,
  sendMessageBack,
  sendPostBack,
  setDictateInterims,
  setDictateState,
  setSendBox,
  setSendTimeout,
  startDictate,
  startSpeakingActivity,
  stopDictate,
  stopSpeakingActivity,
  submitSendBox
};

function styleSetToClassNames(styleSet) {
  return mapMap(styleSet, (style, key) => (key === 'options' ? style : css(style)));
}

function createCardActionContext({ cardActionMiddleware, directLine, dispatch }) {
  const runMiddleware = concatMiddleware(cardActionMiddleware, createCoreCardActionMiddleware())({ dispatch });

  return {
    onCardAction: cardAction =>
      runMiddleware(({ cardAction: { type } }) => {
        throw new Error(`Web Chat: received unknown card action "${type}"`);
      })({
        cardAction,
        getSignInUrl:
          cardAction.type === 'signin'
            ? () => {
                const { value } = cardAction;

                if (directLine.getSessionId) {
                  // TODO: [P3] We should change this one to async/await.
                  //       This is the first place in this project to use async.
                  //       Thus, we need to add @babel/plugin-transform-runtime and @babel/runtime.

                  return observableToPromise(directLine.getSessionId()).then(
                    sessionId => `${value}${encodeURIComponent(`&code_challenge=${sessionId}`)}`
                  );
                }

                console.warn('botframework-webchat: OAuth is not supported on this Direct Line adapter.');

                return value;
              }
            : null
      })
  };
}

function createFocusSendBoxContext({ sendBoxRef }) {
  return {
    focusSendBox: () => {
      const { current } = sendBoxRef || {};

      current && current.focus();
    }
  };
}

const Composer = ({
  activityRenderer,
  attachmentRenderer,
  cardActionMiddleware,
  children,
  directLine,
  disabled,
  extraStyleSet,
  grammars,
  groupTimestamp,
  locale,
  renderMarkdown,
  scrollToEnd,
  selectVoice,
  sendBoxRef,
  sendTimeout,
  sendTyping,
  sendTypingIndicator,
  styleOptions,
  styleSet,
  userID,
  username,
  webSpeechPonyfillFactory
}) => {
  const dispatch = useDispatch();
  const [referenceGrammarID] = useReferenceGrammarID();
  const [dictateAbortable, setDictateAbortable] = useState();

  const patchedGrammars = useMemo(() => grammars || [], [grammars]);
  const patchedSendTypingIndicator = useMemo(() => {
    if (typeof sendTyping === 'undefined') {
      return sendTypingIndicator;
    }

    // TODO: [P3] Take this deprecation code out when releasing on or after January 13 2020
    console.warn(
      'Web Chat: "sendTyping" has been renamed to "sendTypingIndicator". Please use "sendTypingIndicator" instead. This deprecation migration will be removed on or after January 13 2020.'
    );

    return sendTyping;
  }, [sendTyping, sendTypingIndicator]);

  useEffect(() => {
    dispatch(setLanguage(locale));
  }, [dispatch, locale]);

  useEffect(() => {
    dispatch(setSendTimeout(sendTimeout));
  }, [dispatch, sendTimeout]);

  useEffect(() => {
    dispatch(setSendTypingIndicator(!!patchedSendTypingIndicator));
  }, [dispatch, patchedSendTypingIndicator]);

  useEffect(() => {
    dispatch(
      createConnectAction({
        directLine,
        userID,
        username
      })
    );

    return () => {
      // TODO: [P3] disconnect() is an async call (pending -> fulfilled), we need to wait, or change it to reconnect()
      dispatch(disconnect());
    };
  }, [dispatch, directLine, userID, username]);

  const cardActionContext = useMemo(() => createCardActionContext({ cardActionMiddleware, directLine, dispatch }), [
    cardActionMiddleware,
    directLine,
    dispatch
  ]);

  const patchedSelectVoice = useCallback(selectVoice || defaultSelectVoice.bind(null, { language: locale }), [
    selectVoice
  ]);

  const focusSendBoxContext = useMemo(() => createFocusSendBoxContext({ sendBoxRef }), [sendBoxRef]);

  const patchedStyleSet = useMemo(
    () => styleSetToClassNames({ ...(styleSet || createStyleSet(styleOptions)), ...extraStyleSet }),
    [extraStyleSet, styleOptions, styleSet]
  );

  const hoistedDispatchers = useMemo(
    () => mapMap(DISPATCHERS, dispatcher => (...args) => dispatch(dispatcher(...args))),
    [dispatch]
  );

  const webSpeechPonyfill = useMemo(() => {
    const ponyfill = webSpeechPonyfillFactory && webSpeechPonyfillFactory({ referenceGrammarID });
    const { speechSynthesis, SpeechSynthesisUtterance } = ponyfill || {};

    return {
      ...ponyfill,
      speechSynthesis: speechSynthesis || bypassSpeechSynthesis,
      SpeechSynthesisUtterance: SpeechSynthesisUtterance || BypassSpeechSynthesisUtterance
    };
  }, [referenceGrammarID, webSpeechPonyfillFactory]);

  // This is a heavy function, and it is expected to be only called when there is a need to recreate business logic, e.g.
  // - User ID changed, causing all send* functions to be updated
  // - send

  // TODO: [P3] We should think about if we allow the user to change onSendBoxValueChanged/sendBoxValue, e.g.
  // 1. Turns text into UPPERCASE
  // 2. Filter out profanity

  // TODO: [P4] Revisit all members of context
  //       This context should consist of members that are not in the Redux store
  //       i.e. members that are not interested in other types of UIs
  const context = useMemo(
    () => ({
      ...cardActionContext,
      ...focusSendBoxContext,
      ...hoistedDispatchers,
      activityRenderer,
      attachmentRenderer,
      dictateAbortable,
      directLine,
      disabled,
      grammars: patchedGrammars,
      groupTimestamp,
      renderMarkdown,
      scrollToEnd,
      selectVoice: patchedSelectVoice,
      sendBoxRef,
      sendTimeout,
      sendTypingIndicator: patchedSendTypingIndicator,
      setDictateAbortable,
      styleOptions,
      styleSet: patchedStyleSet,
      userID,
      username,
      webSpeechPonyfill
    }),
    [
      activityRenderer,
      attachmentRenderer,
      cardActionContext,
      dictateAbortable,
      directLine,
      disabled,
      focusSendBoxContext,
      groupTimestamp,
      hoistedDispatchers,
      patchedGrammars,
      patchedSelectVoice,
      patchedSendTypingIndicator,
      patchedStyleSet,
      renderMarkdown,
      scrollToEnd,
      sendBoxRef,
      sendTimeout,
      setDictateAbortable,
      styleOptions,
      userID,
      username,
      webSpeechPonyfill
    ]
  );

  return (
    <WebChatUIContext.Provider value={context}>
      <SayComposer ponyfill={webSpeechPonyfill}>
        {typeof children === 'function' ? children(context) : children}
      </SayComposer>
      <Dictation />
    </WebChatUIContext.Provider>
  );
};

// We will create a Redux store if it was not passed in
const ComposeWithStore = ({ store, ...props }) => {
  const memoizedStore = useMemo(() => store || createStore(), [store]);

  return (
    <Provider context={WebChatReduxContext} store={memoizedStore}>
      <ScrollToBottomComposer>
        <ScrollToBottomFunctionContext.Consumer>
          {({ scrollToEnd }) => <Composer scrollToEnd={scrollToEnd} {...props} />}
        </ScrollToBottomFunctionContext.Consumer>
      </ScrollToBottomComposer>
    </Provider>
  );
};

ComposeWithStore.defaultProps = {
  store: undefined
};

ComposeWithStore.propTypes = {
  store: PropTypes.any
};

export default ComposeWithStore;

// TODO: [P3] We should consider moving some data from Redux store to props
//       Although we use `connectToWebChat` to hide the details of accessor of Redux store,
//       we should clean up the responsibility between Context and Redux store
//       We should decide which data is needed for React but not in other environment such as CLI/VSCode

Composer.defaultProps = {
  activityRenderer: undefined,
  attachmentRenderer: undefined,
  cardActionMiddleware: undefined,
  children: undefined,
  disabled: false,
  extraStyleSet: undefined,
  grammars: [],
  groupTimestamp: true,
  locale: window.navigator.language || 'en-US',
  renderMarkdown: undefined,
  selectVoice: undefined,
  sendBoxRef: undefined,
  sendTimeout: 20000,
  sendTyping: undefined,
  sendTypingIndicator: false,
  styleOptions: {},
  styleSet: undefined,
  userID: '',
  username: '',
  webSpeechPonyfillFactory: undefined
};

Composer.propTypes = {
  activityRenderer: PropTypes.func,
  attachmentRenderer: PropTypes.func,
  cardActionMiddleware: PropTypes.func,
  children: PropTypes.any,
  directLine: PropTypes.shape({
    activity$: PropTypes.shape({
      subscribe: PropTypes.func.isRequired
    }).isRequired,
    connectionStatus$: PropTypes.shape({
      subscribe: PropTypes.func.isRequired
    }).isRequired,
    end: PropTypes.func,
    getSessionId: PropTypes.func,
    postActivity: PropTypes.func.isRequired,
    referenceGrammarID: PropTypes.string,
    token: PropTypes.string
  }).isRequired,
  disabled: PropTypes.bool,
  extraStyleSet: PropTypes.any,
  grammars: PropTypes.arrayOf(PropTypes.string),
  groupTimestamp: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  locale: PropTypes.string,
  renderMarkdown: PropTypes.func,
  scrollToEnd: PropTypes.func.isRequired,
  selectVoice: PropTypes.func,
  sendBoxRef: PropTypes.shape({
    current: PropTypes.any
  }),
  sendTimeout: PropTypes.number,
  sendTyping: PropTypes.bool,
  sendTypingIndicator: PropTypes.bool,
  styleOptions: PropTypes.any,
  styleSet: PropTypes.any,
  userID: PropTypes.string,
  username: PropTypes.string,
  webSpeechPonyfillFactory: PropTypes.func
};
