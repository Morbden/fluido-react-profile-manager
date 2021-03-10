import { useEffect } from 'react'
import { createState, useState } from '@hookstate/core'
import firebase from 'firebase'

export interface ProfileProps {
  loaded: boolean
  logged: boolean
  user: firebase.User
  userToken: string
  claims: string[]
}

export interface ProfileManagerProps {
  FCMKey?: string
  firebaseApp: firebase.app.App
  onCallHomeRoute?: VoidFunction
  onCallLoginRoute?: VoidFunction
  pathname?: string
  loggedRedirectRoutePaths?: string[]
  publicRoutePaths?: string[]
}

type ProfileFCMTokenType = 'waiting' | 'loading' | 'error' | 'required' | string

const ProfileState = createState<ProfileProps>({
  loaded: false,
  logged: false,
  user: null,
  userToken: null,
  claims: [],
})

export const useProfile = () => useState<ProfileProps>(ProfileState)

export const ProfileFCMToken = createState<ProfileFCMTokenType>('waiting')

const testIsSSR = () => {
  try {
    return !window
  } catch (err) {
    return true
  }
}

const ProfileManager: React.FunctionComponent<ProfileManagerProps> = ({
  firebaseApp,
  FCMKey,
  onCallHomeRoute,
  onCallLoginRoute,
  pathname,
  loggedRedirectRoutePaths = [],
  publicRoutePaths = ['/'],
}) => {
  const isSSR = testIsSSR()
  // FCM config
  const FCMToken = useState(ProfileFCMToken)

  // Profile Provider
  const profile = useProfile()

  useEffect(() => {
    let metaRef: firebase.database.Reference

    const callback = (snapshot: firebase.database.DataSnapshot) => {
      profile.merge({
        loaded: true,
        claims: snapshot.val() || {},
      })
    }
    return firebaseApp.auth().onAuthStateChanged((user) => {
      if (metaRef) {
        metaRef.off('value', callback)
        metaRef = null
      }

      profile.merge({
        logged: !!user,
        user,
      })

      if (user) {
        user.getIdToken(true).then((token) => {
          profile.merge({
            userToken: token,
          })
        })

        metaRef = firebaseApp.database().ref(`users/${user.uid}/claims`)
        metaRef.on('value', callback)
      } else {
        profile.merge({
          loaded: true,
          userToken: null,
        })
      }
    })
  }, [isSSR])

  // Page blocker
  useEffect(() => {
    if (!isSSR && profile.loaded.value) {
      if (!profile.logged.value && !publicRoutePaths.includes(pathname)) {
        if (onCallLoginRoute) onCallLoginRoute()
      } else if (
        profile.logged.value &&
        loggedRedirectRoutePaths.includes(pathname)
      ) {
        if (onCallHomeRoute) onCallHomeRoute()
      }
    }
  }, [isSSR, profile.logged.value, profile.loaded.value, pathname])

  // FCM Loader
  useEffect(() => {
    if (!isSSR && FCMKey) {
      FCMToken.set('loading')
      const messaging = firebaseApp.messaging()
      messaging
        .getToken({ vapidKey: FCMKey })
        .then(async (token) => {
          if (token) {
            FCMToken.set(token)
          } else {
            FCMToken.set('required')
          }
        })
        .catch((err: Error) => {
          if (err.message.includes('permission-blocked')) {
            FCMToken.set('required')
          } else {
            console.log(err)
          }
          FCMToken.set('error')
        })
    }
  }, [isSSR, FCMKey])

  useEffect(() => {
    if (
      !isSSR &&
      profile.logged.value &&
      profile.loaded.value &&
      FCMToken.value &&
      !['error', 'required', 'loading', 'waiting'].includes(FCMToken.value)
    ) {
      firebaseApp
        .database()
        .ref(`users/${profile.user.value.uid}/fcm`)
        .set(FCMToken.value)
    }
  }, [isSSR, FCMToken.value, profile.logged.value, profile.loaded.value])

  return null
}

export default ProfileManager
