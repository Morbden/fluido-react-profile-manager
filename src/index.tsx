import { useLayoutEffect } from 'react'
import { createState, useState } from '@hookstate/core'
import firebase from 'firebase'

export interface ProfileProps {
  loaded: boolean
  logged: boolean
  user: firebase.User
  userToken: string
  claims: {
    [key: string]: string[]
  }
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
  claims: {},
})

export const useProfile = () => useState<ProfileProps>(ProfileState)

export const ProfileFCMToken = createState<ProfileFCMTokenType>('waiting')

const ProfileManager: React.FunctionComponent<ProfileManagerProps> = ({
  firebaseApp,
  FCMKey,
  onCallHomeRoute,
  onCallLoginRoute,
  pathname,
  loggedRedirectRoutePaths = [],
  publicRoutePaths = ['/'],
}) => {
  // FCM config
  const FCMToken = useState(ProfileFCMToken)

  // Profile Provider
  const profile = useProfile()

  useLayoutEffect(() => {
    let metaRef: firebase.database.Reference
    let claimsRef: firebase.database.Reference
    let callback: VoidFunction = null
    return firebaseApp.auth().onAuthStateChanged((user) => {
      if (metaRef) {
        metaRef.off('value', callback)
        metaRef = null
        callback = null
      }

      if (claimsRef) {
        claimsRef.off()
        claimsRef = null
      }

      profile.merge({
        logged: !!user,
        user,
      })

      if (user) {
        callback = () => {
          user.getIdToken(true).then((token) => {
            profile.merge({
              userToken: token,
            })
          })
        }

        metaRef = firebaseApp.database().ref(`users/${user.uid}/claims/refresh`)
        metaRef.on('value', callback)

        claimsRef = firebaseApp.database().ref(`users/${user.uid}/claims`)
        claimsRef.on('value', (snapshot) => {
          profile.merge({
            claims: snapshot.val(),
          })
        })
      } else {
        profile.merge({
          loaded: true,
          userToken: null,
        })
      }
    })
  }, [])

  // Page blocker
  useLayoutEffect(() => {
    if (profile.loaded.value) {
      if (!profile.logged.value && !publicRoutePaths.includes(pathname)) {
        if (onCallLoginRoute) onCallLoginRoute()
      } else if (
        profile.logged.value &&
        loggedRedirectRoutePaths.includes(pathname)
      ) {
        if (onCallHomeRoute) onCallHomeRoute()
      }
    }
  }, [profile.logged.value, profile.loaded.value, pathname])

  // FCM Loader
  useLayoutEffect(() => {
    if (FCMKey) {
      try {
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
      } catch (err) {}
    }
  }, [FCMKey])

  useLayoutEffect(() => {
    if (
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
  }, [FCMToken.value, profile.logged.value, profile.loaded.value])

  return null
}

export default ProfileManager
