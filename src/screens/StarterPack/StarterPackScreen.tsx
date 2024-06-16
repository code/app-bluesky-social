import React from 'react'
import {Pressable, View} from 'react-native'
import {AppBskyGraphDefs, AppBskyGraphStarterpack} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'
import {NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQueryClient} from '@tanstack/react-query'

import {makeProfileLink, makeStarterPackLink} from 'lib/routes/links'
import {CommonNavigatorParams, NavigationProp} from 'lib/routes/types'
import {shareUrl} from 'lib/sharing'
import {logEvent} from 'lib/statsig/statsig'
import {isWeb} from 'platform/detection'
import {useSetUsedStarterPack} from 'state/preferences/starter-pack'
import {RQKEY} from 'state/queries/list-members'
import {useResolveDidQuery} from 'state/queries/resolve-uri'
import {useStarterPackQuery} from 'state/queries/useStarterPackQuery'
import {useAgent, useSession} from 'state/session'
import {useLoggedOutViewControls} from 'state/shell/logged-out'
import * as Toast from '#/view/com/util/Toast'
import {PagerWithHeader} from 'view/com/pager/PagerWithHeader'
import {ProfileSubpageHeader} from 'view/com/profile/ProfileSubpageHeader'
import {CenteredView} from 'view/com/util/Views'
import {bulkWriteFollows} from '#/screens/Onboarding/util'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {ArrowOutOfBox_Stroke2_Corner0_Rounded as ArrowOutOfBox} from '#/components/icons/ArrowOutOfBox'
import {QrCode_Stroke2_Corner0_Rounded as QrCode} from '#/components/icons/QrCode'
import {ListMaybePlaceholder} from '#/components/Lists'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import {FeedsList} from '#/components/StarterPack/Main/FeedsList'
import {ProfilesList} from '#/components/StarterPack/Main/ProfilesList'
import {QrCodeDialog} from '#/components/StarterPack/QrCodeDialog'
import {Text} from '#/components/Typography'

export function StarterPackScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'StarterPack'>) {
  const {_} = useLingui()

  const {name, rkey} = route.params
  const {
    data: did,
    isLoading: isLoadingDid,
    isError: isErrorDid,
  } = useResolveDidQuery(name)
  const {
    data: starterPack,
    isLoading: isLoadingStarterPack,
    isError: isErrorStarterPack,
  } = useStarterPackQuery({did, rkey})

  const isValid =
    starterPack &&
    AppBskyGraphDefs.validateStarterPackView(starterPack) &&
    AppBskyGraphStarterpack.validateRecord(starterPack.record)

  if (!did || !starterPack || !isValid) {
    return (
      <ListMaybePlaceholder
        isLoading={isLoadingDid || isLoadingStarterPack}
        isError={isErrorDid || isErrorStarterPack || !isValid}
        errorMessage={_(msg`That starter pack could not be found.`)}
      />
    )
  }

  const items = [
    ...(starterPack.list ? ['People'] : []),
    ...(starterPack.feeds?.length ? ['Feeds'] : []),
  ]

  return (
    <CenteredView style={[a.h_full_vh]}>
      <View style={isWeb ? {minHeight: '100%'} : {height: '100%'}}>
        <PagerWithHeader
          items={items}
          isHeaderReady={true}
          renderHeader={() => (
            <Header starterPack={starterPack} name={name} rkey={rkey} />
          )}>
          {starterPack.list
            ? ({headerHeight, scrollElRef}) => (
                <ProfilesList
                  key={0}
                  // @ts-expect-error TODO
                  listUri={starterPack.list.uri}
                  headerHeight={headerHeight}
                  // @ts-expect-error
                  scrollElRef={scrollElRef}
                />
              )
            : null}
          {starterPack.feeds
            ? ({headerHeight, scrollElRef}) => (
                <FeedsList
                  key={1}
                  // @ts-expect-error TODO
                  feeds={starterPack.feeds}
                  headerHeight={headerHeight}
                  // @ts-expect-error
                  scrollElRef={scrollElRef}
                />
              )
            : null}
        </PagerWithHeader>
      </View>
    </CenteredView>
  )
}

function Header({
  starterPack,
  name,
  rkey,
}: {
  starterPack: AppBskyGraphDefs.StarterPackView
  name: string
  rkey: string
}) {
  const {_} = useLingui()
  const t = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const {currentAccount} = useSession()
  const agent = useAgent()
  const queryClient = useQueryClient()
  const qrCodeDialogControl = useDialogControl()
  const setUsedStarterPack = useSetUsedStarterPack()
  const {setShowLoggedOut} = useLoggedOutViewControls()

  const [isProcessing, setIsProcessing] = React.useState(false)

  const {record, creator} = starterPack
  const isOwn = creator?.did === currentAccount?.did

  const onFollowAll = async () => {
    if (!starterPack.list) return

    setIsProcessing(true)

    try {
      const list = await agent.app.bsky.graph.getList({
        list: starterPack.list.uri,
      })
      const dids = list.data.items
        .filter(li => !li.subject.viewer?.following)
        .map(li => li.subject.did)

      await bulkWriteFollows(agent, dids)

      await queryClient.refetchQueries({
        queryKey: RQKEY(starterPack.list.uri),
      })

      Toast.show(_(msg`All accounts have been followed!`))
    } catch (e) {
      Toast.show(_(msg`An error occurred while trying to follow all`))
    } finally {
      setIsProcessing(false)
    }
  }

  if (!AppBskyGraphStarterpack.isRecord(record)) {
    return null
  }

  return (
    <>
      <ProfileSubpageHeader
        isLoading={false}
        href={makeProfileLink(creator)}
        title={record.name}
        isOwner={isOwn}
        avatar={undefined}
        creator={creator}
        starterPack={starterPack}
        avatarType="starter-pack">
        <View style={[a.flex_row, a.gap_sm]}>
          {__DEV__ && (
            <Button
              label={_(msg`Edit`)}
              variant="solid"
              color="secondary"
              size="small"
              onPress={() => {
                setUsedStarterPack({uri: starterPack.uri})
                setShowLoggedOut(true)
              }}>
              <ButtonText>
                <Trans>Debug</Trans>
              </ButtonText>
            </Button>
          )}
          <Menu.Root>
            <Menu.Trigger label={_(msg`Repost or quote post`)}>
              {({props, state}) => (
                <Pressable
                  style={[
                    a.px_lg,
                    a.py_sm,
                    a.align_center,
                    a.justify_center,
                    a.rounded_sm,
                    {
                      backgroundColor: isOwn
                        ? t.palette.primary_500
                        : t.palette.contrast_25,
                    },
                    (state.hovered || state.pressed) && {
                      backgroundColor: isOwn
                        ? t.palette.primary_600
                        : t.palette.contrast_50,
                    },
                  ]}
                  {...props}>
                  <Text
                    style={[
                      a.font_bold,
                      {
                        color: isOwn
                          ? 'white'
                          : t.atoms.text_contrast_medium.color,
                      },
                    ]}>
                    <Trans>Share</Trans>
                  </Text>
                </Pressable>
              )}
            </Menu.Trigger>
            <Menu.Outer style={{minWidth: 170}}>
              <Menu.Group>
                <Menu.Item
                  label={_(msg`Share link`)}
                  testID="shareStarterPackLinkBtn"
                  onPress={() => {
                    logEvent('starterPack:share', {
                      starterPack: starterPack.uri,
                      shareType: 'link',
                    })
                    shareUrl(makeStarterPackLink(name, rkey))
                  }}>
                  <Menu.ItemText>
                    <Trans>Share link</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={ArrowOutOfBox} position="right" />
                </Menu.Item>
                <Menu.Item
                  label={_(msg`Create QR code`)}
                  testID="createQRCodeBtn"
                  onPress={qrCodeDialogControl.open}>
                  <Menu.ItemText>
                    <Trans>Create QR code</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={QrCode} position="right" />
                </Menu.Item>
              </Menu.Group>
            </Menu.Outer>
          </Menu.Root>
          {isOwn ? (
            <Button
              label={_(msg`Edit`)}
              variant="solid"
              color="secondary"
              size="small"
              onPress={() =>
                navigation.navigate('StarterPackWizard', {name, rkey})
              }>
              <ButtonText>
                <Trans>Edit</Trans>
              </ButtonText>
            </Button>
          ) : (
            <Button
              label={_(msg`Follow all`)}
              variant="solid"
              color="primary"
              size="small"
              disabled={isProcessing}
              onPress={onFollowAll}>
              <ButtonText>
                <Trans>Follow all</Trans>
                {isProcessing && <Loader size="xs" />}
              </ButtonText>
            </Button>
          )}
        </View>
      </ProfileSubpageHeader>
      <View style={[a.px_md, a.py_lg, a.gap_md]}>
        <Text style={[a.text_md]}>{record.description}</Text>
        {starterPack.joinedWeekCount && starterPack.joinedWeekCount >= 25 ? (
          <Text style={[a.font_bold, a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>
              {starterPack.joinedAllTimeCount || 0} people have used this
              starter pack!
            </Trans>
          </Text>
        ) : null}
      </View>
      <QrCodeDialog control={qrCodeDialogControl} starterPack={starterPack} />
    </>
  )
}