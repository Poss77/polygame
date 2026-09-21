-- ==============================================================================
-- POLYGON GAMING: COMPREHENSIVE INCIDENT REMEDIATION & DATABASE LOCKDOWN
-- Target Incident: Malicious bulk fake user injection & referral hijacking
-- Attacker Account: Dobby TheDEV (0xpgt003e7625 / 0x602BEc371e2A99f679C73A5930a590CeBf8e7696)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Purge all 6,051 unauthenticated fake bot injection rows created today
-- ------------------------------------------------------------------------------
DELETE FROM public.users
WHERE created_at >= '2026-09-21T00:00:00Z'
  AND user_id IS NULL;

-- ------------------------------------------------------------------------------
-- STEP 2: Restore all 242 legitimate users' original referral uplines (from backup)
-- ------------------------------------------------------------------------------
UPDATE public.users AS u
SET referred_by_l1 = v.original_l1
FROM (
  VALUES
    ('0xpgtdb4748d3', NULL::TEXT),
    ('0xpgta58dc6d4', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtcd580e53', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt11f3d9e4', '0xpgt25c12fd2'),
    ('0xpgtda0bff1c', '0xpgt3a44cee7'),
    ('0xpgtd398f15c', '0xpgt25c12fd2'),
    ('0xpgt0a3d8fab', NULL),
    ('0xpgt709b6141', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgt79a194ed1485', '0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000'),
    ('0xpgt85c8416473bd6a8c45ada81ac85aeabb', NULL),
    ('0xpgt169c1562e10c', NULL),
    ('0xpgt33682426', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgtaed6eeab', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt9322cdde', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpen_test_bot_999999', NULL),
    ('0xpgt301ecdb9', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgte0981799', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgt1fb8e320', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt08891829df91813056bbd8d6e838cdc4', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt77da88ad069dcbb6195c50845c9328c1', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgta1fd850b', NULL),
    ('0xpgt80153522', '0xpgt3a44cee7'),
    ('0xpgt10bf5152', NULL),
    ('0xpgtae31c8f5', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgta19879b5f01550a4826dc62f452e78f6', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt5cf75e12', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgte86a3bf6', '0xpgt3a44cee7'),
    ('0xpgt58f5eb8c', '0xpgt3a44cee7'),
    ('0xpgtc779730f', '0xpgt25c12fd2'),
    ('0xpgtaca69358', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgt572e1a30', '0xpgt3a44cee7'),
    ('0xpgt16369ba7b638f3dc53817f5309c4965c', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtb115ab5b', '0xpgt25c12fd2'),
    ('0xpgt1340d9e6', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt305d0f00', '0xpgt3a44cee7'),
    ('0xpgt37555f37', NULL),
    ('0xpgt25c12fd2', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt5e64957dabcde8ba47239a359f61b6f1', NULL),
    ('0xpgtc25b3224c126', NULL),
    ('0xpgt6c30c08c', '0xpgt3a44cee7'),
    ('0xpgt3d8ee006', '0xpgt1340d9e6'),
    ('0xpgtfa22fc0c', '0xpgt25c12fd2'),
    ('0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt3a44cee7', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt9ddc0ca3', '0xpgt3a44cee7'),
    ('0xpgt2aa64159', '0xpgt3a44cee7'),
    ('0xpgtf6a9a748636544a9a83d80cef9a8a40900000', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xqa_test_bot_001', NULL),
    ('0xpgt8312e02d37185b5983e6922d1dae1cce', '0xpgt85c8416473bd6a8c45ada81ac85aeabb'),
    ('0xpgt003e7625', '0xpgt25c12fd2'),
    ('0xpgt_test_1788897255', NULL),
    ('0xpgt66ce5565', '0xpgt3d8ee006'),
    ('0xpgt3d2a93cb07664203b9dabd7f1454ca6f00000', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtddeff05e', NULL),
    ('0xprobad123', NULL),
    ('0xpgt31ab923c', '0xpgt31ab923c'),
    ('0xpgt2ff75f4b', '0xpgt1340d9e6'),
    ('0xpgtff79df2b', '0xpgt66ce5565'),
    ('0xpgt_unban_test_xyz', NULL),
    ('0xpgt236e9b8e', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgtd6c88ba475c04696b0d78d2da526ae9800000', NULL),
    ('0xpgt1315acc40000000000000000000000000000', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('__TEST__', NULL),
    ('0xpgtd377d74e', NULL),
    ('0xpgt14bb92276d60bbe3', NULL),
    ('0xpgt20a86495', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgt002a11071fa8', NULL),
    ('0xpgt6732ac3f9a69', NULL),
    ('0xpgt6f58ef3c', NULL),
    ('0xpgtc15b9c7f', NULL),
    ('0xpgtab1cb35b97cc', NULL),
    ('0xpgte441b7c61723a7abfe84f68f3eaba7c5', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtc00c48bd', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgt930c3e09', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtb4d7ffbf80ec', NULL),
    ('0xpgta9fe5522', NULL),
    ('0xpgtcabcde00dbdc03509d9e7638c8dc4c66', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt7a37da9f', NULL),
    ('0xpgtbd97919e10da', NULL),
    ('0xpgt0c43cb4f5a0e3510169c728f345e1cc5', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgte531b9c0', '0xpgt25c12fd2'),
    ('0xpgt86eb5daa4afb8bc0216ba00367c04459', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt58c566a3d57c28197064a9eb12c9d4af', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt6d27fe1e88906908f78a0b0f747f3a59', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtbypasslkdc45ed', NULL),
    ('0xpgtc35a70593431ba43e74a6f090cac524b', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt88960edb2e5ebea572ba143665a8c549', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt46fd5bf2fd52eb885013092c0f5b493d', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt547cd106609765b9bc1b5e792555cc90', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt140af8e61800bb84628b664fa3237c6d', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtdc5742c2', NULL),
    ('0xpgt_test_inject_001', NULL),
    ('0xpgt461a068f0bd48378c8f93a4eadb77152', NULL),
    ('0xpgt4b2fbd2c530a', NULL),
    ('0xguest53824305882bf4b7c0de643ce831fd07e68', NULL),
    ('0xlimit_test_player_per_game', NULL),
    ('0xpgt3654727c61a3f649296b0593e8d34f55', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt9c5311544a4eb42ab944fa665d1ec6da', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtc1604a68', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt67c421543c92743b4a53886d2d95c6b4', NULL),
    ('0xpgtff8d7c7288e0de1f6e33270c7b910003', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt065138bc', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt8593a143b4a148ba871fd3e61732de3300000', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt59abcfac', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt3fc8473b', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgt3664bba8', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt5a80f59316d0', NULL),
    ('0xpgt80e061b2001b444a2f85691a80083912', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtce9e4cac09e74b29413f17201a3a81c9', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt3e0460cc', NULL),
    ('0xpgtbe5176ba85bcdcd295f6d62ed4e2fb78', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtfa3625a3', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgt4f647c90', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgttestestra1', NULL),
    ('0xpgtf31af29b', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt99899f669a8d2eb3b41605fb14c72e8f', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtd1167929', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xgacaa74acb35848f98b17e27d767a526c0000000', NULL),
    ('0xgc4f4fd434e03448d87db1bb80856f31e0000000', NULL),
    ('0xgc2dac34e99be4d76921e54e2cc5307620000000', NULL),
    ('0xpgt01ebfc90caed4d1388bb8fd41311baf000000', NULL),
    ('0xgb1bccb47d5f144ea86a2a5c9d7a704680000000', NULL),
    ('0xpgt7865f5db8190af2ea08d3aea71d7802e', NULL),
    ('0xpgtddd15932ea3e2804d1624a238ff85610', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtda696630ee3f6c961c151e72e2dd1a98', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt383f36cc', '0xpgt66ce5565'),
    ('0xpgtf0fc21149d7a82f7c9c0ad6a5d67cbe1', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtadc2b03dc6ee2023325f6757e79f9e88', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt3606a936', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgtae1ddb8338f3687eb0188466174c4436', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt6072a7977413476100c80668c3777544', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt2f2cd869', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtd00b4ea6', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt2f3e29fc', NULL),
    ('0xpgta6dbf221', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtb7b365db', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtf227ac7d5b2b3c51bd4bcf3d13a3d343', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt3df6a922d87975124b68a7f560873f16', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xg1d58027144a5400aa997849d6cb6229b0000000', NULL),
    ('0xpgt887aa414', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgta4ebc997', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgtdf714a7a0ac4939c700c17a7830543d7', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt4c0be5c6', '0xpgt2ff75f4b'),
    ('0xpgtb7e70c31c232a25a6c7bd742746defbe', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt6342026d', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgta89a5215', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt9822a86a2fd62434f2204a9e19b7c86c', NULL),
    ('0xpgt5d4db9c8777649cd94980cd7d6301e5300000', NULL),
    ('0xpgteb31ff4ab7dbce488a50054fa7e3e9ad', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtad6bf76a', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtb99f26a1', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt8ddd7f5c', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtac5b435f0000000000000000000000000000', NULL),
    ('0xpgt978d167e7a2cb6daa264a2d172f58ecb', NULL),
    ('0xgda1aed34396d4f9cbeef1cb3aff0fb0d0000000', NULL),
    ('0xpgt20b2e5c4925f3b650119e65846a9a0e6', NULL),
    ('0xpgtfedeb39a77e9d41ec82e70dfeee5ce78', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt_anti_cheat_test_1', NULL),
    ('0xpgt31e1af7a', '0xpgt25c12fd2'),
    ('0xpgte7fb6dfce5f17d46d852fd6b59f76d61', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xtest_player_arcade_payout', NULL),
    ('0xpgtd05703ee', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgtd8fbd240efa2bda6a5aa8298b723c2fc', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtf4aabc3d30556e5f9599ee9f73eee950', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt6e47d6b1441b89685def5ab69052b53a', NULL),
    ('0xpgt19ebddd14bc0097d4eea35221a5a36b5e7495', NULL),
    ('0xpgt312c4f3b', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgt49508bd5ccc244f1cf2c329a68226bb1', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgta7c8ba2f076d6e6fc839fcd4814c25f2', NULL),
    ('0xpgta65275de', NULL),
    ('0xpgtc66ddaa29ef82d1cd6c9d0ddaf1bb268', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtc729fff75a5e15069119787e12e003cc', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt08eacc79cb274894b9832aebfb68539300000', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt5245941ae5b56524288866d9b31262d5', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtf6255d92', NULL),
    ('0xpgtf9a7f35b', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgt9509073841a7af5e085a3163070db83a', NULL),
    ('0xpgtaad27334', NULL),
    ('0xpgttest0000000', NULL),
    ('0xpgt19510360', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgta6cd26b9295ef8ec92bb1fbcaa9f31b6', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtec17d5c4d6f432602446c522e2316cf2', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt21f04f30', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgtb64d0c68', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtba9cdcc7dc85d2bc2628fd972e444bc1', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtf0e36f2e2347', NULL),
    ('0xpgt8139342d55064ffc0dfaae7473050b4f', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgte2fbd5292fd682f14cd58bc6b07cca8e', NULL),
    ('0xpgt338257cae0ff', NULL),
    ('0xpgtdfaf326c', NULL),
    ('0xpgta644059a2ced845def6575c50aef0231', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtb14ae14a', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtff6fda35a3de20f030a067a7b5740e6c', NULL),
    ('0xpgtabee26e03db3886496e1360c3680dd93', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtcaa399dce3f9bbef3690f32cc3633634', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt4b291b17c59ec3146a07f719977f3b83', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt32e91a7e2e9dc475c45eee30021da1ac', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt587bcc6d4e382e109e1f2217224ac0f2', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtc4b1739d', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgt310eefce9e36d1dade09bfa4599cd71e', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgta88e6c2744b1c5f59ca6aa8d77553aaa', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgte8fd3354', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgt99585cf8ec9e765e8acd8b05d4c6601f', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt0e4ee4ab14b6491087c52fd201ea68a400000', NULL),
    ('0xpgt76918a60c5eb8aa9ee6bd361dff5d8b3', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtaa6f70bd576470c1df2ddb112300eb9d', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgttesthgnwjgam', NULL),
    ('0xpgtba5671c23af88d3c8dbbb615475742ec', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt580e96cb6e6c8ee9c5cef230058cc4b5', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt0ea191de', NULL),
    ('0xpgte7a6fa83a05647a91bb8cc312b90bc09', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgteab47ba5', NULL),
    ('0xpgt28b733061c5c8538a19c3e9722b2acb4', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtc7310073b3ae40bc9c7543bccc7b490700000', NULL),
    ('0xpgte9583e4a', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgt19564445', NULL),
    ('0xpgtde440530', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtd26d292431039cae512ba33953eecb8b', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt9a5c7166', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgtcb4622e2f04b528470881d3a423c0478', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt8400521c', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtccc84ccd', '0xpgt25c12fd2'),
    ('0xpgt5bdaab9a', '0xpgt08891829df91813056bbd8d6e838cdc4'),
    ('0xpgteff03e330000000000000000000000000000', NULL),
    ('0xpgt8fd21415c285181dd5cf1a2b3b72314a', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt7aa30a10', NULL),
    ('0xpgt7db6e89a', NULL),
    ('0xpgtf542078cfef7', '0xpgt31ab923c'),
    ('0xpgtc5215c1d80db2220', NULL),
    ('0xpgt2a698d81', NULL),
    ('0xpgt9d1f037b', NULL),
    ('0xpgt5bcd3b8b', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtb6638298', '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'),
    ('0xpgt1695ffd2b03c', NULL),
    ('0xpgt7a63df3581a539e0b2d0747122bf8d8d', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xsecurity_audit_test_probe_1', NULL),
    ('0xpgt9f529cad', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xgd386f7c7047643fdabfc9005a8f55d7b0000000', NULL),
    ('0xpgt0b3393db3ee8', NULL),
    ('0xpgt5b3e02103b9008617f2793182a92651d', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgt3b0d511f4c2b9b6fc4ad06666b7a342d', '0xpgt8312e02d37185b5983e6922d1dae1cce'),
    ('0xpgtff25ca4fc17b2ffc210760a7bb6903ed', NULL)
) AS v(player_id, original_l1)
WHERE u.player_id = v.player_id;

-- ------------------------------------------------------------------------------
-- STEP 3: Reassign hijacked referral commissions to their authentic uplines
-- ------------------------------------------------------------------------------
-- Poss (0xpgt8312e02d37185b5983e6922d1dae1cce) is the true upline for Vezuvius King, CRiMiNeL, and Paul V:
UPDATE public.referral_commissions
SET upline_player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce'
WHERE upline_player_id = '0xpgt003e7625'
  AND downline_player_id IN ('0xpgt1340d9e6', '0xpgt25c12fd2', '0xpgt3a44cee7');

-- Paul V (0xpgt3a44cee7) is the true upline for Cybermix and TopTop:
UPDATE public.referral_commissions
SET upline_player_id = '0xpgt3a44cee7'
WHERE upline_player_id = '0xpgt003e7625'
  AND downline_player_id IN ('0xpgt58f5eb8c', '0xpgt9ddc0ca3');

-- ------------------------------------------------------------------------------
-- STEP 4: Credit stolen commissions to legitimate uplines & strip gains from Dobby
-- ------------------------------------------------------------------------------
-- Re-credit Poss (+314.916 PGT):
UPDATE public.users
SET unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + 314.916,
    total_referral_commission = COALESCE(total_referral_commission, 0) + 314.916
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce';

-- Re-credit Paul V (+18.35 PGT):
UPDATE public.users
SET unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + 18.35,
    total_referral_commission = COALESCE(total_referral_commission, 0) + 18.35
WHERE player_id = '0xpgt3a44cee7';

-- Strip Dobby's illicit gains and ban the account:
UPDATE public.users
SET unclaimed_referral_pgt = 0.0,
    total_referral_commission = 0.0,
    referrals_count = 0,
    referrals_l1 = 0,
    referrals_list = '[]'::jsonb,
    is_banned = true,
    bot_warning = 99
WHERE player_id = '0xpgt003e7625' OR linked_wallet_address ILIKE '0x602BEc371e2A99f679C73A5930a590CeBf8e7696';

-- ------------------------------------------------------------------------------
-- STEP 5: Dynamic RLS Policy Purge & Table-Level Privilege Lockdown on public.users
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.users';
    END LOOP;
END $$;

-- Table-level grants: revoke all write permissions from anon/public
REVOKE ALL ON TABLE public.users FROM anon, public;
GRANT SELECT ON TABLE public.users TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role, postgres;

-- Strict RLS enforcement
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read users" ON public.users
    FOR SELECT TO anon, authenticated, service_role
    USING (true);

CREATE POLICY "Allow authenticated insert users" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Allow authenticated update users" ON public.users
    FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Schema-wide protection: revoke write permissions from anon/public on ALL public tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, public;

-- ------------------------------------------------------------------------------
-- STEP 6: Deploy Patched assert_caller_player_id (Rejects anon & SECURITY DEFINER bypass)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_caller_player_id(
  p_target_id TEXT,
  OUT p_status TEXT,
  OUT p_player_id TEXT,
  OUT p_error_msg TEXT
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT := auth.role();
  v_auth_uid UUID := auth.uid();
  v_caller_pid TEXT;
  v_resolved_target TEXT;
BEGIN
  -- 1. Explicitly reject unauthenticated web/REST clients (anon role or missing uid on web):
  IF v_role = 'anon' OR (v_role = 'authenticated' AND v_auth_uid IS NULL) THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: Please sign in with Google or connect your wallet.';
    RETURN;
  END IF;

  -- 2. Allow internal server execution:
  -- Allowed only for service_role or direct background DB triggers/jobs without JWT context
  IF v_role = 'service_role' OR (v_role IS NULL AND v_auth_uid IS NULL) THEN
    p_status := 'OK';
    p_player_id := public.resolve_player_id(p_target_id);
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 3. Caller MUST have an authentic Supabase Auth session
  IF v_auth_uid IS NULL THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: Please sign in with Google or connect your wallet.';
    RETURN;
  END IF;

  -- 4. Lookup caller's player_id in public.users
  SELECT player_id INTO v_caller_pid
  FROM public.users
  WHERE user_id = v_auth_uid
  LIMIT 1;

  IF v_caller_pid IS NULL THEN
    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist for this session.';
    RETURN;
  END IF;

  -- 5. Anti-Framing Assertion:
  -- If target ID was passed by client, it MUST resolve to the caller's own player_id.
  IF p_target_id IS NOT NULL AND TRIM(p_target_id) <> '' THEN
    v_resolved_target := public.resolve_player_id(p_target_id);
    IF v_resolved_target IS NOT NULL AND LOWER(v_resolved_target) <> LOWER(v_caller_pid) THEN
      PERFORM public.record_bot_warning(
        v_caller_pid,
        'identity_impersonation_attempt',
        'Security Sentinel',
        jsonb_build_object('attempted_target', p_target_id, 'resolved_target', v_resolved_target)
      );
      p_status := 'MISMATCH';
      p_player_id := v_caller_pid;
      p_error_msg := 'SECURITY_VIOLATION: You cannot perform actions on behalf of another player.';
      RETURN;
    END IF;
  END IF;

  p_status := 'OK';
  p_player_id := v_caller_pid;
  p_error_msg := NULL;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_caller_player_id(TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.assert_caller_player_id(TEXT) FROM anon, public;

-- ------------------------------------------------------------------------------
-- STEP 7: Permanent Schema Invariants (No wallet_address)
-- ------------------------------------------------------------------------------
ALTER TABLE public.users DROP COLUMN IF EXISTS wallet_address;
DROP INDEX IF EXISTS public.idx_users_wallet_address;
