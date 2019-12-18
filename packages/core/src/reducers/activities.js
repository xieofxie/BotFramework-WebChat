/* eslint no-magic-numbers: ["error", { "ignore": [0, -1] }] */

import updateIn from 'simple-update-in';

import { DELETE_ACTIVITY } from '../actions/deleteActivity';
import { INCOMING_ACTIVITY } from '../actions/incomingActivity';
import { MARK_ACTIVITY } from '../actions/markActivity';

import { POST_ACTIVITY_FULFILLED, POST_ACTIVITY_PENDING, POST_ACTIVITY_REJECTED } from '../actions/postActivity';

import { SEND_FAILED, SENDING, SENT } from '../constants/ActivityClientState';

const DEFAULT_STATE = [];

function getClientActivityID({ channelData: { clientActivityID } = {} }) {
  return clientActivityID;
}

function findByClientActivityID(clientActivityID) {
  return activity => getClientActivityID(activity) === clientActivityID;
}

function upsertActivityWithSort(activities, nextActivity) {
  const { channelData: { clientActivityID: nextClientActivityID } = {} } = nextActivity;

  const nextTimestamp = Date.parse(nextActivity.timestamp);
  const nextActivities = activities.filter(
    ({ channelData: { clientActivityID } = {} }) =>
      // We will remove all "sending messages" activities
      // "clientActivityID" is unique and used to track if the message has been sent and echoed back from the server
      !(nextClientActivityID && clientActivityID === nextClientActivityID)
  );

  // Then, find the right (sorted) place to insert the new activity at, based on timestamp
  // Since clockskew might happen, we will ignore timestamp on messages that are sending

  const indexToInsert = nextActivities.findIndex(
    ({ channelData: { state } = {}, timestamp }) =>
      Date.parse(timestamp) > nextTimestamp && state !== SENDING && state !== SEND_FAILED
  );

  // If no right place are found, append it
  nextActivities.splice(~indexToInsert ? indexToInsert : nextActivities.length, 0, nextActivity);

  return nextActivities;
}

export default function activities(state = DEFAULT_STATE, { meta, payload, type }) {
  switch (type) {
    case DELETE_ACTIVITY:
      state = updateIn(state, [({ id }) => id === payload.activityID]);
      break;

    case MARK_ACTIVITY:
      state = updateIn(
        state,
        [({ id }) => id === payload.activityID, 'channelData', payload.name],
        () => payload.value
      );
      break;

    case POST_ACTIVITY_PENDING:
      state = upsertActivityWithSort(
        state,
        updateIn(payload.activity, ['channelData', 'state'], () => SENDING)
      );
      break;

    case POST_ACTIVITY_REJECTED:
      state = updateIn(
        state,
        [findByClientActivityID(meta.clientActivityID), 'channelData', 'state'],
        () => SEND_FAILED
      );
      break;

    case POST_ACTIVITY_FULFILLED:
      state = updateIn(state, [findByClientActivityID(meta.clientActivityID)], () =>
        // We will replace the activity with the version from the server
        updateIn(payload.activity, ['channelData', 'state'], () => SENT)
      );

      break;

    case INCOMING_ACTIVITY:
      // UpdateActivity is not supported right now because we ignore duplicated activity ID
      // TODO: [P4] Move "typing" into Constants.ActivityType
      if (payload.activity.type !== 'typing' && !~state.findIndex(({ id }) => id === payload.activity.id)) {
        state = upsertActivityWithSort(state, payload.activity);
      }

      break;

    default:
      break;
  }

  return state;
}
