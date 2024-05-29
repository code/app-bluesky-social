import React from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useBottomBarOffset} from 'lib/hooks/useBottomBarOffset'
import {ViewHeader} from 'view/com/util/ViewHeader'
import {CenteredView} from 'view/com/util/Views'
import {useWizardState} from '#/screens/StarterPack/Wizard/State'
import {StepLanding} from '#/screens/StarterPack/Wizard/StepLanding'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Provider} from './State'

export function Wizard() {
  return (
    <Provider>
      <WizardInner />
    </Provider>
  )
}

function WizardInner() {
  const {_} = useLingui()
  const bottomOffset = useBottomBarOffset()
  const [__, dispatch] = useWizardState()

  return (
    <CenteredView style={[a.flex_1, {marginBottom: bottomOffset + 20}]}>
      <ViewHeader title="Create a starter pack" />
      <Step />
      <View style={a.px_md}>
        <Button
          label={_(msg`Create`)}
          variant="solid"
          color="primary"
          size="large"
          onPress={() => dispatch({type: 'Next'})}>
          <ButtonText>
            <Trans>Create</Trans>
          </ButtonText>
        </Button>
      </View>
    </CenteredView>
  )
}

function Step() {
  const [state] = useWizardState()

  if (state.currentStep === 'Landing') {
    return <StepLanding />
  }
}
